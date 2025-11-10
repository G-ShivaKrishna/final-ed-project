from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.supabase_client import supabase
import json
import logging
import requests
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
import random
import string
import time


# --- configure these per your prompt ---
API_KEY = "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"
DEEPSEEK_URL = "https://openrouter.ai/api/v1/chat/completions"
# --- end config ---

logger = logging.getLogger(__name__)


def _extract_text_from_openrouter(resp_json: dict) -> str:
    # OpenRouter-like responses commonly contain choices[].message.content or choices[].text
    choices = resp_json.get("choices") or []
    if choices:
        first = choices[0]
        # two common shapes
        if isinstance(first, dict):
            msg = first.get("message") or first.get("delta") or {}
            text = msg.get("content") if isinstance(msg, dict) else None
            if text:
                return text
            if "text" in first and isinstance(first["text"], str):
                return first["text"]
    # fallback to any top-level field that looks useful
    for key in ("answer", "result", "completion", "content", "output"):
        v = resp_json.get(key)
        if isinstance(v, str) and v.strip():
            return v
    # final fallback: stringify the payload
    return json.dumps(resp_json)


@csrf_exempt
@api_view(['POST'])
def ask(request):
    if request.method != "POST":
        return HttpResponse(status=405)

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception as e:
        logger.exception("Invalid JSON in request body")
        return HttpResponseBadRequest(json.dumps({"error": "invalid json"}), content_type="application/json")

    # Accept either "prompt" or full "messages" list
    prompt = payload.get("prompt")
    messages = payload.get("messages")
    if not messages:
        if isinstance(prompt, str) and prompt.strip():
            messages = [{"role": "user", "content": prompt}]
        else:
            return HttpResponseBadRequest(json.dumps({"error": "missing 'prompt' or 'messages'"}), content_type="application/json")

    # Build OpenRouter payload (model choice can be changed)
    upstream_payload = {
        "model": payload.get("model", "gpt-4o-mini"),  # change model if needed
        "messages": messages,
        # keep other optional fields if provided (temperature, max_tokens, etc)
    }
    # copy allowed optional params from client
    for key in ("temperature", "max_tokens", "top_p", "n"):
        if key in payload:
            upstream_payload[key] = payload[key]

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(DEEPSEEK_URL, json=upstream_payload, headers=headers, timeout=30)
        resp.raise_for_status()
        resp_json = resp.json()
        answer = _extract_text_from_openrouter(resp_json)
        return JsonResponse({"answer": answer})
    except requests.exceptions.RequestException as e:
        logger.exception("Upstream request to OpenRouter failed")
        return JsonResponse({"error": "upstream request failed", "details": str(e)}, status=502)
    except Exception as e:
        logger.exception("Failed processing OpenRouter response")
        return JsonResponse({"error": "internal server error", "details": str(e)}, status=500)


# Helper: normalize supabase execute() response to a single row or None
def _single_from_resp(resp):
    """
    resp: object returned by supabase .execute()
    returns: dict (row) or None
    """
    if resp is None:
        return None
    data = getattr(resp, 'data', None)
    if isinstance(data, list):
        return data[0] if data else None
    return data


@api_view(['GET'])
def lookup_user_by_username(request):
	"""Lookup a user by username and return id, email, role if found.

	GET params:
	  - username: the username to look up

	Returns JSON { id, email, role } or 404.
	"""
	username = request.GET.get('username')
	if not username:
		return Response({"error": "username query parameter is required"}, status=400)

	try:
		resp = supabase.table('users').select('id, email, role').eq('username', username).execute()
		if getattr(resp, 'error', None):
			return Response({"error": str(resp.error)}, status=500)
		row = _single_from_resp(resp)
		if not row:
			return Response({"error": "not_found"}, status=404)
		return Response(row)
	except Exception as e:
		return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def create_user_record(request):
	"""Create a record in the Supabase `users` table for a given auth user id.

	Expects JSON body: { id, email, username, role, College?, phone_number?, major? }
	"""
	data = request.data
	user_id = data.get('id')
	email = data.get('email')
	username = data.get('username')
	role = data.get('role')

	if not user_id or not email or not username or not role:
		return Response({"error": "id, email, username and role are required"}, status=400)

	payload = {
		'id': user_id,
		'email': email,
		'username': username,
		'role': role,
	}
	# optional fields
	for opt in ('College', 'phone_number', 'major'):
		if opt in data:
			payload[opt] = data[opt]

	try:
		resp = supabase.table('users').insert(payload).execute()
		if getattr(resp, 'error', None):
			return Response({"error": str(resp.error)}, status=500)
		return Response({"data": resp.data}, status=201)
	except Exception as e:
		return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def get_user_profile(request):
	"""Fetch a user profile from Supabase `users` table by user_id query param.

	Returns id, email, username, role, created_at, College, phone_number, major
	"""
	user_id = request.GET.get('user_id')
	if not user_id:
		return Response({"error": "user_id query parameter is required"}, status=400)

	try:
		# Select the case-sensitive "College" column explicitly
		resp = supabase.table('users').select('id, email, username, role, created_at, "College", phone_number, major').eq('id', user_id).execute()
		if getattr(resp, 'error', None):
			return Response({"error": str(resp.error)}, status=500)
		row = _single_from_resp(resp)
		if not row:
			return Response({"error": "not_found"}, status=404)
		return Response(row)
	except Exception as e:
		return Response({"error": str(e)}, status=500)


@api_view(['PUT', 'PATCH'])
def update_user_profile(request):
	"""Update allowed fields on the Supabase `users` table for a user.

	Accepts JSON body with at least `id` or query param `user_id` plus any of:
	username, major, phone_number, College, email
	"""
	data = request.data
	user_id = data.get('id') or request.GET.get('user_id')
	if not user_id:
		return Response({"error": "user_id (in body as `id` or query param `user_id`) is required"}, status=400)

	allowed_keys = ['username', 'major', 'phone_number', 'College', 'email']
	payload = {k: data[k] for k in allowed_keys if k in data}

	if not payload:
		return Response({"error": "No updatable fields provided"}, status=400)

	try:
		resp = supabase.table('users').update(payload).eq('id', user_id).execute()
		if getattr(resp, 'error', None):
			return Response({"error": str(resp.error)}, status=500)
		# Normalize response data
		data = getattr(resp, 'data', None) or resp.get('data') if isinstance(resp, dict) else None
		error = getattr(resp, 'error', None) or resp.get('error') if isinstance(resp, dict) else None
		status_code = 200 if not error else 400
		return Response({'data': data, 'error': error}, status=status_code)
	except Exception as e:
		return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dashboard_summary(request):
	"""Return dashboard data for a student: enrolled courses count, assignments due count, and assignments list.

	Query params:
	  - user_id: the student's id
	"""
	user_id = request.GET.get('user_id')
	if not user_id:
		return Response({"error": "user_id query parameter is required"}, status=400)

	try:
		# 1) get enrollments
		enroll_resp = supabase.table('enrollments').select('course_id').eq('student_id', user_id).execute()
		if getattr(enroll_resp, 'error', None):
			return Response({"error": str(enroll_resp.error)}, status=500)

		course_ids = [r.get('course_id') for r in (enroll_resp.data or []) if r.get('course_id')]

		enrolled_count = len(course_ids)

		if not course_ids:
			return Response({"enrolled_courses": 0, "assignments_due": 0, "assignments": []})

		# 2) fetch assignments for these courses
		assign_resp = supabase.table('assignments') \
			.select('*, course:courses(*)') \
			.in_('course_id', course_ids) \
			.order('due_date', desc=False) \
			.execute()

		if getattr(assign_resp, 'error', None):
			return Response({"error": str(assign_resp.error)}, status=500)

		assignments = assign_resp.data or []

		# ensure frontend compatibility: alias course.course_id -> course.code
		for a in assignments:
			c = a.get('course')
			if isinstance(c, dict):
				# add code property expected by frontend
				c['code'] = c.get('course_id') or c.get('courseId') or c.get('code')

		# compute assignments_due (not graded and due in future or today)
		from datetime import datetime, timezone

		now = datetime.now(timezone.utc).isoformat()
		assignments_due = [a for a in assignments if (a.get('status') != 'graded')]

		return Response({
			"enrolled_courses": enrolled_count,
			"assignments_due": len(assignments_due),
			"assignments": assignments,
		})
	except Exception as e:
		return Response({"error": str(e)}, status=500)

from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok"})

def _generate_course_id(name: str) -> str:
    prefix = ''.join([w[0] for w in (name or '').split() if w]).upper()[:3].ljust(3, 'X')
    ts = format(int(time.time() * 1000), 'x')[-4:].upper()
    rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=3))
    return f"{prefix}-{ts}{rand}"

@api_view(['POST'])
def create_course(request):
    """Create a new course for an instructor.

    Expects JSON body: { name, instructor_id }
    Returns: { id, name, course_id, created_at, ... }
    """
    data = request.data
    instructor_id = data.get('instructor_id')
    name = data.get('name')

    if not instructor_id or not name:
        return Response({"error": "instructor_id and name are required"}, status=400)

    try:
        max_attempts = 6
        last_err = None
        for attempt in range(max_attempts):
            course_id = _generate_course_id(name)
            # insert only columns that exist in the schema (no description)
            payload = {
                'name': name,
                'instructor_id': instructor_id,
                'created_at': datetime.now().isoformat(),
                'course_id': course_id,
            }
            resp = supabase.table('courses').insert(payload).execute()
            if getattr(resp, 'error', None):
                msg = str(resp.error).lower()
                if 'duplicate' in msg or 'unique' in msg or '23505' in msg or 'already exists' in msg:
                    last_err = resp.error
                    continue
                return Response({"error": str(resp.error)}, status=500)

            inserted = (resp.data[0] if isinstance(resp.data, list) and resp.data else resp.data) or {}
            if isinstance(inserted, dict):
                inserted['code'] = inserted.get('course_id') or inserted.get('courseId')
            return Response(inserted, status=201)

        return Response({"error": "failed to generate unique course_id", "details": str(last_err)}, status=500)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def create_join_request(request):
    """Student requests to join a course by course code (course_id).

    Expects JSON body: { student_id, course_code } OR frontend may send student_id from auth session.
    Returns: created join_request row.
    """
    data = request.data
    student_id = data.get('student_id')
    course_code = data.get('course_code')  # this is the course_id text in DB
    if not student_id or not course_code:
        return Response({"error": "student_id and course_code are required"}, status=400)

    try:
        # find the course by course_id (text code)
        course_resp = supabase.table('courses').select('id, instructor_id, name, course_id').eq('course_id', course_code).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course = _single_from_resp(course_resp)
        if not course:
            return Response({"error": "course_not_found"}, status=404)

        course_db_id = course.get('id')

        # check if student is already enrolled
        enroll_check = supabase.table('enrollments').select('id').eq('course_id', course_db_id).eq('student_id', student_id).execute()
        if getattr(enroll_check, 'error', None):
            pass
        else:
            if _single_from_resp(enroll_check):
                return Response({"error": "already_enrolled"}, status=400)

        # check if there is an existing pending request
        req_check = supabase.table('join_requests').select('id, status').eq('course_db_id', course_db_id).eq('student_id', student_id).execute()
        if getattr(req_check, 'error', None):
            pass
        else:
            existing = _single_from_resp(req_check)
            if existing and existing.get('status') == 'pending':
                return Response({"error": "request_already_pending"}, status=400)
            # allow new request if previous was rejected

        payload = {
            'course_db_id': course_db_id,
            'course_code': course_code,
            'student_id': student_id,
            'status': 'pending',
            'created_at': datetime.now().isoformat(),
        }
        insert_resp = supabase.table('join_requests').insert(payload).execute()
        if getattr(insert_resp, 'error', None):
            return Response({"error": str(insert_resp.error)}, status=500)

        # Return the created request (could be list or single)
        inserted = insert_resp.data[0] if isinstance(insert_resp.data, list) and insert_resp.data else insert_resp.data
        return Response(inserted, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def list_join_requests(request):
    """Instructor lists pending join requests for a course.

    Query params: course_db_id (UUID) and instructor_id (UUID) for simple verification.
    Returns list of pending join_requests with student info (if available).
    """
    course_db_id = request.GET.get('course_db_id')
    instructor_id = request.GET.get('instructor_id')
    if not course_db_id or not instructor_id:
        return Response({"error": "course_db_id and instructor_id query params are required"}, status=400)

    try:
        # verify course belongs to instructor
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # fetch pending requests, include student user details if possible
        # Assumes join_requests.student_id references users.id
        req_resp = supabase.table('join_requests') \
            .select('id, student_id, status, created_at, student:users(username, email)') \
            .eq('course_db_id', course_db_id) \
            .eq('status', 'pending') \
            .order('created_at', desc=False) \
            .execute()
        if getattr(req_resp, 'error', None):
            return Response({"error": str(req_resp.error)}, status=500)

        return Response(req_resp.data or [])
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def respond_join_request(request):
    """Instructor accepts/rejects a join request.

    Expects JSON body: { request_id, action, instructor_id } where action is 'accept' or 'reject'.
    On accept: create an enrollment row (course_id = course_db_id, student_id) and mark request accepted.
    """
    data = request.data
    request_id = data.get('request_id')
    action = data.get('action')
    instructor_id = data.get('instructor_id')
    if not request_id or action not in ('accept', 'reject') or not instructor_id:
        return Response({"error": "request_id, action ('accept'|'reject') and instructor_id are required"}, status=400)

    try:
        # fetch the join_request
        jr_resp = supabase.table('join_requests').select('*').eq('id', request_id).execute()
        if getattr(jr_resp, 'error', None):
            return Response({"error": str(jr_resp.error)}, status=500)
        jr = _single_from_resp(jr_resp)
        if not jr:
            return Response({"error": "request_not_found"}, status=404)
        course_db_id = jr.get('course_db_id')
        student_id = jr.get('student_id')

        # verify instructor owns the course
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        if action == 'accept':
            # create enrollment (avoid duplicates)
            enroll_check = supabase.table('enrollments').select('id').eq('course_id', course_db_id).eq('student_id', student_id).execute()
            if getattr(enroll_check, 'error', None):
                pass
            else:
                if _single_from_resp(enroll_check):
                    supabase.table('join_requests').update({'status': 'accepted'}).eq('id', request_id).execute()
                    return Response({"result": "already_enrolled"}, status=200)

            enroll_payload = {
                'course_id': course_db_id,
                'student_id': student_id,
            }
            enroll_resp = supabase.table('enrollments').insert(enroll_payload).execute()
            if getattr(enroll_resp, 'error', None):
                return Response({"error": str(enroll_resp.error)}, status=500)

            # update request status
            supabase.table('join_requests').update({'status': 'accepted'}).eq('id', request_id).execute()
            return Response({"result": "accepted"}, status=200)
        else:
            # reject
            supabase.table('join_requests').update({'status': 'rejected'}).eq('id', request_id).execute()
            return Response({"result": "rejected"}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
