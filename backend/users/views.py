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
from postgrest.exceptions import APIError


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


def _list_from_resp(resp):
    """
    Normalize a supabase .execute() response into a Python list.
    Accepts objects with .data, dicts like {'data': [...]}, plain lists, or single-row dicts.
    Always returns a list (possibly empty).
    """
    if resp is None:
        return []
    # object with .data attribute
    if hasattr(resp, 'data'):
        d = getattr(resp, 'data', None)
    elif isinstance(resp, dict):
        d = resp.get('data', None)
    else:
        d = resp

    if d is None:
        return []
    if isinstance(d, list):
        return d
    if isinstance(d, dict):
        return [d]
    # fallback: coerce to list
    try:
        return list(d)
    except Exception:
        return []


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
        # If not found, try by email (for legacy/test users)
        row = _single_from_resp(resp)
        if not row:
            # Try by email if user_id looks like an email
            if "@" in user_id:
                resp2 = supabase.table('users').select('id, email, username, role, created_at, "College", phone_number, major').eq('email', user_id).execute()
                row = _single_from_resp(resp2)
                if not row:
                    return Response({"error": "not_found"}, status=404)
                return Response(row)
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
		logger.info("dashboard_summary requested for user_id=%s", user_id)
		# 1) get enrollments
		enroll_resp = supabase.table('enrollments').select('course_id').eq('student_id', user_id).execute()
		if getattr(enroll_resp, 'error', None):
			logger.exception("enrollments query error")
			return Response({"error": str(enroll_resp.error)}, status=500)

		# enrollments.course_id stores the course code (text) per schema
		enroll_rows = _list_from_resp(enroll_resp)
		course_codes = [r.get('course_id') for r in enroll_rows if r.get('course_id')]
		enrolled_count = len(course_codes)

		if not course_codes:
			return Response({"enrolled_courses": 0, "assignments_due": 0, "assignments": []})

		# map course codes -> course UUIDs so we can fetch assignments which reference courses.id
		courses_resp = supabase.table('courses').select('id, course_id').in_('course_id', course_codes).execute()
		if getattr(courses_resp, 'error', None):
			logger.exception("courses lookup error")
			return Response({"error": str(courses_resp.error)}, status=500)
		course_rows = _list_from_resp(courses_resp)
		course_ids = [r.get('id') for r in course_rows if r.get('id')]
		if not course_ids:
			# no matching courses found (shouldn't normally happen), return empty assignments
			return Response({"enrolled_courses": enrolled_count, "assignments_due": 0, "assignments": []})

		# 2) fetch assignments for these courses
		try:
			# assignments reference the courses table via course_db_id (UUID) — query by that column
			assign_resp = supabase.table('assignments') \
				.select('*, course:courses(*)') \
				.in_('course_db_id', course_ids) \
				.order('due_date', desc=False) \
				.execute()
			if getattr(assign_resp, 'error', None):
				logger.exception("assignments lookup error")
				return Response({"error": str(assign_resp.error)}, status=500)
			assignments = _list_from_resp(assign_resp)
		except APIError as e:
			# PostgREST raises APIError when the table isn't found in the schema cache (PGRST205).
			# Log and return an empty assignments list so the frontend continues to function.
			logger.warning("Assignments table missing or PostgREST schema cache mismatch: %s", e)
			assignments = []
		except Exception as e:
			# Unexpected errors still surface
			logger.exception("Unexpected error fetching assignments")
			return Response({"error": "assignments_lookup_failed", "details": str(e)}, status=500)

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
		logger.exception("dashboard_summary failed")
		# return error details for easier debugging; in production hide details
		return Response({"error": "internal_server_error", "details": str(e)}, status=500)


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
        # enrollments.course_id stores the course.code (text), check by code
        enroll_check = supabase.table('enrollments').select('id').eq('course_id', course_code).eq('student_id', student_id).execute()
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
        course_code = jr.get('course_code')  # text code stored when student requested join

        # verify instructor owns the course
        course_resp = supabase.table('courses').select('id, instructor_id, course_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        if action == 'accept':
            # create enrollment (avoid duplicates)
            # enrollments use course_code text; check by course_code stored on request
            enroll_check = supabase.table('enrollments').select('id').eq('course_id', course_code).eq('student_id', student_id).execute()
            if getattr(enroll_check, 'error', None):
                pass
            else:
                if _single_from_resp(enroll_check):
                    supabase.table('join_requests').update({'status': 'accepted'}).eq('id', request_id).execute()
                    return Response({"result": "already_enrolled"}, status=200)

            # insert enrollment using course code (text) per schema
            enroll_payload = {
                'course_id': course_code,
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


@api_view(['GET'])
def list_enrolled_students(request):
    """
    Instructor lists enrolled students for a course.

    Query params: course_db_id (UUID) and instructor_id (UUID) are required.
    Returns list of enrollments with student info: [{ id, student_id, joined_at, student: { id, username, email } }, ...]
    """
    course_db_id = request.GET.get('course_db_id')
    instructor_id = request.GET.get('instructor_id')
    if not course_db_id or not instructor_id:
        return Response({"error": "course_db_id and instructor_id query params are required"}, status=400)

    try:
        # verify course belongs to instructor
        course_resp = supabase.table('courses').select('id, instructor_id, course_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # enrollments.store course_id as the course code (text) per schema; fetch by course_code
        course_code = course_row.get('course_id')
        enroll_resp = supabase.table('enrollments') \
            .select('id, student_id, joined_at, student:users(id, username, email)') \
            .eq('course_id', course_code) \
            .order('joined_at', desc=False) \
            .execute()
        if getattr(enroll_resp, 'error', None):
            return Response({"error": str(enroll_resp.error)}, status=500)

        return Response(enroll_resp.data or [])
    except Exception as e:
        return Response({"error": str(e)}, status=500)


def resolve_course_by_identifier(identifier: str):
    """
    Resolve a course by either its UUID 'id' or its textual course_id (code).
    Returns the course row dict or None.
    """
    if not identifier:
        return None
    try:
        # try by id first
        resp = supabase.table('courses').select('id, instructor_id, course_id, name').eq('id', identifier).execute()
        if not getattr(resp, 'error', None):
            row = _single_from_resp(resp)
            if row:
                return row
        # fallback: try by course_id (text code)
        resp2 = supabase.table('courses').select('id, instructor_id, course_id, name').eq('course_id', identifier).execute()
        if not getattr(resp2, 'error', None):
            row2 = _single_from_resp(resp2)
            if row2:
                return row2
    except Exception:
        # swallow and return None to allow caller to handle not-found
        logger.exception("resolve_course_by_identifier failed for %s", identifier)
    return None


@api_view(['GET'])
def list_course_assignments(request):
    """
    List assignments for a course.
    Query params: course_db_id, user_id (viewer). Viewer must be instructor or enrolled student.
    """
    course_db_id = request.GET.get('course_db_id')
    user_id = request.GET.get('user_id')
    if not course_db_id or not user_id:
        return Response({"error": "course_db_id and user_id are required"}, status=400)

    try:
        # resolve course by either DB id or textual course code
        course_row = resolve_course_by_identifier(course_db_id)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)

        # check enrolment or instructor
        if str(course_row.get('instructor_id')) != str(user_id):
            enroll_resp = supabase.table('enrollments').select('id').eq('course_id', course_row.get('course_id')).eq('student_id', user_id).execute()
            if getattr(enroll_resp, 'error', None):
                # if error checking enrollment, still attempt to return public assignments
                pass
            else:
                if not _single_from_resp(enroll_resp):
                    return Response({"error": "forbidden"}, status=403)

        # fetch assignments and include the related course row (so frontend can access course.code)
        try:
            assign_resp = supabase.table('assignments') \
                .select('*, course:courses(id, course_id, name)') \
                .eq('course_db_id', course_db_id) \
                .order('due_date', desc=False) \
                .execute()
            if getattr(assign_resp, 'error', None):
                return Response({"error": str(assign_resp.error)}, status=500)
            rows = _list_from_resp(assign_resp)
        except APIError as e:
            logger.warning("Assignments table missing or PostgREST schema cache mismatch: %s", e)
            rows = []
        except Exception as e:
            logger.exception("Unexpected error fetching assignments")
            return Response({"error": "assignments_lookup_failed", "details": str(e)}, status=500)

        # Normalize course.course_id -> course.code for frontend
        assignment_ids = []
        for a in rows:
            c = a.get('course')
            if isinstance(c, dict):
                c['code'] = c.get('course_id') or c.get('courseId') or c.get('code')
            if a.get('id'):
                assignment_ids.append(a.get('id'))

        # Fetch student's submissions for these assignments and attach (if any)
        submissions_map: dict = {}
        if assignment_ids:
            try:
                subs_resp = supabase.table('submissions') \
                    .select('*') \
                    .in_('assignment_id', assignment_ids) \
                    .eq('student_id', user_id) \
                    .execute()
                if getattr(subs_resp, 'error', None):
                    logger.warning("submissions lookup error: %s", subs_resp.error)
                else:
                    subs_list = _list_from_resp(subs_resp)
                    for s in subs_list:
                        submissions_map[str(s.get('assignment_id'))] = s
            except Exception as e:
                logger.exception("Failed to fetch submissions for user")

        # attach submission to assignments
        for a in rows:
            aid = str(a.get('id')) if a.get('id') is not None else None
            if aid and aid in submissions_map:
                a['submission'] = submissions_map[aid]
                a['status'] = submissions_map[aid].get('status', a.get('status', 'submitted'))

        return Response(rows)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def submit_assignment(request):
    """
    Student submits an assignment.
    Body JSON: { student_id, assignment_id, file_url?, text_submission? }
    """
    data = request.data
    student_id = data.get('student_id')
    assignment_id = data.get('assignment_id')
    if not student_id or not assignment_id:
        return Response({"error": "student_id and assignment_id are required"}, status=400)

    try:
        # verify assignment exists and get course
        ass_resp = supabase.table('assignments').select('id, course_db_id').eq('id', assignment_id).execute()
        if getattr(ass_resp, 'error', None):
            return Response({"error": str(ass_resp.error)}, status=500)
        assignment = _single_from_resp(ass_resp)
        if not assignment:
            return Response({"error": "assignment_not_found"}, status=404)
        course_db_id = assignment.get('course_db_id')

        # verify student is enrolled in that course (map course_db_id -> course.course_id if needed)
        course_resp = supabase.table('courses').select('id, course_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course = _single_from_resp(course_resp)
        if not course:
            return Response({"error": "course_not_found"}, status=404)

        enroll_check = supabase.table('enrollments').select('id').eq('course_id', course.get('course_id')).eq('student_id', student_id).execute()
        if getattr(enroll_check, 'error', None):
            # if enrollment check failed, still return error to be safe
            return Response({"error": str(enroll_check.error)}, status=500)
        if not _single_from_resp(enroll_check):
            return Response({"error": "not_enrolled"}, status=403)

        payload = {
            'assignment_id': assignment_id,
            'student_id': student_id,
            'file_url': data.get('file_url'),
            'text_submission': data.get('text_submission'),
            'status': 'submitted',
            'submitted_at': datetime.now().isoformat(),
        }
        ins = supabase.table('submissions').insert(payload).execute()
        if getattr(ins, 'error', None):
            return Response({"error": str(ins.error)}, status=500)
        inserted = ins.data[0] if isinstance(ins.data, list) and ins.data else ins.data
        return Response(inserted, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def grade_submission(request):
    """
    Instructor grades a submission.
    Body JSON: { grader_id, submission_id, grade, feedback? }
    """
    data = request.data
    grader_id = data.get('grader_id')
    submission_id = data.get('submission_id')
    grade = data.get('grade')
    if not grader_id or not submission_id or grade is None:
        return Response({"error": "grader_id, submission_id and grade are required"}, status=400)

    try:
        # fetch submission and the assignment/course
        sub_resp = supabase.table('submissions').select('id, assignment_id, student_id').eq('id', submission_id).execute()
        if getattr(sub_resp, 'error', None):
            return Response({"error": str(sub_resp.error)}, status=500)
        sub = _single_from_resp(sub_resp)
        if not sub:
            return Response({"error": "submission_not_found"}, status=404)

        ass_resp = supabase.table('assignments').select('id, course_db_id, created_by').eq('id', sub.get('assignment_id')).execute()
        if getattr(ass_resp, 'error', None):
            return Response({"error": str(ass_resp.error)}, status=500)
        assignment = _single_from_resp(ass_resp)
        if not assignment:
            return Response({"error": "assignment_not_found"}, status=404)

        # verify grader is instructor of the course
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', assignment.get('course_db_id')).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course = _single_from_resp(course_resp)
        if not course:
            return Response({"error": "course_not_found"}, status=404)
        if str(course.get('instructor_id')) != str(grader_id):
            return Response({"error": "forbidden"}, status=403)

        upd = {
            'grade': grade,
            'feedback': data.get('feedback'),
            'grader_id': grader_id,
            'graded_at': datetime.now().isoformat(),
            'status': 'graded',
        }
        upd_resp = supabase.table('submissions').update(upd).eq('id', submission_id).execute()
        if getattr(upd_resp, 'error', None):
            return Response({"error": str(upd_resp.error)}, status=500)
        return Response({'result': 'graded'}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def add_course_resource(request):
    """
    Instructor adds a syllabus entry or video link to a course.
    Body: { instructor_id, course_db_id, type: 'syllabus'|'video', title?, content?, video_url? }
    """
    data = request.data
    instructor_id = data.get('instructor_id')
    course_db_id = data.get('course_db_id')
    rtype = data.get('type')
    if not instructor_id or not course_db_id or rtype not in ('syllabus', 'video'):
        return Response({"error": "instructor_id, course_db_id and valid type are required"}, status=400)

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

        payload = {
            'course_db_id': course_db_id,
            'type': rtype,
            'title': data.get('title'),
            'content': data.get('content'),
            'video_url': data.get('video_url'),
            'created_by': instructor_id,
            'created_at': datetime.now().isoformat(),
        }
        ins = supabase.table('course_resources').insert(payload).execute()
        if getattr(ins, 'error', None):
            return Response({"error": str(ins.error)}, status=500)
        inserted = ins.data[0] if isinstance(ins.data, list) and ins.data else ins.data
        return Response(inserted, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def list_course_resources(request):
    """
    List syllabus entries and videos for a course. Query params: course_db_id, user_id
    """
    course_db_id = request.GET.get('course_db_id')
    user_id = request.GET.get('user_id')
    if not course_db_id or not user_id:
        return Response({"error": "course_db_id and user_id required"}, status=400)

    try:
        # resolve course by either DB id or textual course code
        course_row = resolve_course_by_identifier(course_db_id)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)

        if str(course_row.get('instructor_id')) != str(user_id):
            enroll_check = supabase.table('enrollments').select('id').eq('course_id', course_row.get('course_id')).eq('student_id', user_id).execute()
            if getattr(enroll_check, 'error', None):
                pass
            else:
                if not _single_from_resp(enroll_check):
                    return Response({"error": "forbidden"}, status=403)

        res = supabase.table('course_resources').select('*').eq('course_db_id', course_db_id).order('created_at', desc=False).execute()
        if getattr(res, 'error', None):
            return Response({"error": str(res.error)}, status=500)
        rows = _list_from_resp(res)
        return Response(rows)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def delete_course(request):
    """Delete a course (instructor only).

    Expects JSON body: { course_db_id: <courses.id>, instructor_id: <auth user id> }
    Returns: { result: "deleted" } on success.
    """
    data = request.data
    course_db_id = data.get('course_db_id')
    instructor_id = data.get('instructor_id')
    if not course_db_id or not instructor_id:
        return Response({"error": "course_db_id and instructor_id are required"}, status=400)

    try:
        # verify course exists and belongs to instructor
        course_resp = supabase.table('courses').select('id, instructor_id, course_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # perform delete (DB cascade will remove related rows if configured)
        del_resp = supabase.table('courses').delete().eq('id', course_db_id).execute()
        if getattr(del_resp, 'error', None):
            return Response({"error": str(del_resp.error)}, status=500)

        return Response({"result": "deleted"}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def create_assignment(request):
    """
    Instructor creates an assignment for a course.
    Body JSON: { instructor_id, course_db_id, title, description?, due_date?, points? }
    Returns created assignment row.
    """
    data = request.data
    instructor_id = data.get('instructor_id')
    course_db_id = data.get('course_db_id')
    title = data.get('title')
    if not instructor_id or not course_db_id or not title:
        return Response({"error": "instructor_id, course_db_id and title are required"}, status=400)

    try:
        # verify instructor owns the course
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        payload = {
            'course_db_id': course_db_id,
            'title': title,
            'description': data.get('description'),
            'due_date': data.get('due_date'),
            'points': data.get('points'),
            'created_by': instructor_id,
            'created_at': datetime.now().isoformat(),
        }
        resp = supabase.table('assignments').insert(payload).execute()
        if getattr(resp, 'error', None):
            return Response({"error": str(resp.error)}, status=500)
        inserted = resp.data[0] if isinstance(resp.data, list) and resp.data else resp.data
        return Response(inserted, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def update_assignment(request):
    """
    Instructor updates an assignment.
    Body JSON: { instructor_id, assignment_id, title?, description?, due_date?, points? }
    Returns updated assignment row.
    """
    data = request.data
    instructor_id = data.get('instructor_id')
    assignment_id = data.get('assignment_id')
    if not instructor_id or not assignment_id:
        return Response({"error": "instructor_id and assignment_id are required"}, status=400)

    try:
        # fetch assignment to determine course_db_id
        ass_resp = supabase.table('assignments').select('id, course_db_id').eq('id', assignment_id).execute()
        if getattr(ass_resp, 'error', None):
            return Response({"error": str(ass_resp.error)}, status=500)
        assignment = _single_from_resp(ass_resp)
        if not assignment:
            return Response({"error": "assignment_not_found"}, status=404)

        # verify instructor owns the course
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', assignment.get('course_db_id')).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course = _single_from_resp(course_resp)
        if not course:
            return Response({"error": "course_not_found"}, status=404)
        if str(course.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # prepare update payload (only allow specific fields)
        allowed = {}
        for k in ('title', 'description', 'due_date', 'points'):
            if k in data:
                allowed[k] = data.get(k)

        if not allowed:
            return Response({"error": "no_updatable_fields_provided"}, status=400)

        upd = supabase.table('assignments').update(allowed).eq('id', assignment_id).execute()
        if getattr(upd, 'error', None):
            return Response({"error": str(upd.error)}, status=500)
        updated = _single_from_resp(upd)
        return Response(updated, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['POST'])
def update_course_resource(request):
    """
    Instructor updates a course resource (syllabus / video).
    Body JSON: { instructor_id, resource_id, title?, content?, video_url?, type? }
    Returns updated resource row.
    """
    data = request.data
    instructor_id = data.get('instructor_id')
    resource_id = data.get('resource_id')
    if not instructor_id or not resource_id:
        return Response({"error": "instructor_id and resource_id are required"}, status=400)

    try:
        # fetch resource to determine course_db_id
        res_resp = supabase.table('course_resources').select('id, course_db_id, created_by').eq('id', resource_id).execute()
        if getattr(res_resp, 'error', None):
            return Response({"error": str(res_resp.error)}, status=500)
        resource = _single_from_resp(res_resp)
        if not resource:
            return Response({"error": "resource_not_found"}, status=404)

        # verify instructor owns the course (or created the resource)
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', resource.get('course_db_id')).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course = _single_from_resp(course_resp)
        if not course:
            return Response({"error": "course_not_found"}, status=404)
        if str(course.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # prepare allowed update payload
        allowed = {}
        for k in ('title', 'content', 'video_url', 'type'):
            if k in data:
                allowed[k] = data.get(k)

        if not allowed:
            return Response({"error": "no_updatable_fields_provided"}, status=400)

        upd = supabase.table('course_resources').update(allowed).eq('id', resource_id).execute()
        if getattr(upd, 'error', None):
            return Response({"error": str(upd.error)}, status=500)
        updated = _single_from_resp(upd)
        return Response(updated, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def list_course_submissions(request):
    """
    Instructor view: list all submissions for assignments in a course.
    Query params: course_db_id (UUID) and instructor_id (UUID) required.
    Returns list of submissions with assignment and student info.
    """
    course_db_id = request.GET.get('course_db_id')
    instructor_id = request.GET.get('instructor_id')
    if not course_db_id or not instructor_id:
        return Response({"error": "course_db_id and instructor_id are required"}, status=400)

    try:
        # verify instructor owns the course
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', course_db_id).execute()
        if getattr(course_resp, 'error', None):
            logger.error("courses lookup failed: %s", getattr(course_resp, 'error', None))
            return Response({"error": str(course_resp.error)}, status=500)
        course_row = _single_from_resp(course_resp)
        if not course_row:
            return Response({"error": "course_not_found"}, status=404)
        if str(course_row.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # fetch assignments ids for this course
        assign_resp = supabase.table('assignments').select('id, title').eq('course_db_id', course_db_id).execute()
        if getattr(assign_resp, 'error', None):
            logger.error("assignments lookup failed: %s", getattr(assign_resp, 'error', None))
            return Response({"error": str(assign_resp.error)}, status=500)
        assigns = _list_from_resp(assign_resp)
        assign_ids = [a.get('id') for a in assigns if a.get('id')]

        if not assign_ids:
            return Response([])

        # fetch submissions for these assignments and include student info
        try:
            # Explicitly choose the relationships because `users` is referenced
            # by both submissions.student_id and submissions.grader_id.
            # Use PostgREST relationship alias syntax: users!<fk_name>
            subs_resp = supabase.table('submissions') \
                .select('*, grader:users!submissions_grader_id_fkey(id, username, email), student:users!submissions_student_id_fkey(id, username, email)') \
                .in_('assignment_id', assign_ids) \
                .order('submitted_at', desc=True) \
                .execute()
            if getattr(subs_resp, 'error', None):
                logger.error("submissions lookup failed: %s", getattr(subs_resp, 'error', None))
                return Response({"error": str(subs_resp.error)}, status=500)
            subs = _list_from_resp(subs_resp) or []
        except APIError as e:
            # Schema/cache issue — log and return empty set so instructor UI still works
            logger.warning("Assignments/submissions table missing or PostgREST schema cache mismatch: %s", e)
            subs = []
        except Exception as e:
            logger.exception("Unexpected error fetching submissions")
            return Response({"error": "submissions_lookup_failed", "details": str(e)}, status=500)

        # attach assignment title for convenience
        assign_map = { str(a.get('id')): a.get('title') for a in assigns }
        for s in subs:
            try:
                s['assignment_title'] = assign_map.get(str(s.get('assignment_id')), '')
                # normalize nested student and grader objects if present
                st = s.get('student')
                if isinstance(st, dict):
                    s['student'] = {'id': st.get('id'), 'username': st.get('username'), 'email': st.get('email')}
                gr = s.get('grader')
                if isinstance(gr, dict):
                    s['grader'] = {'id': gr.get('id'), 'username': gr.get('username'), 'email': gr.get('email')}
            except Exception:
                # don't fail entire response for a single malformed row
                logger.exception("Failed to normalize submission row: %s", s)
        return Response(subs)
    except Exception as e:
        logger.exception("list_course_submissions failed unexpectedly")
        # Return minimal error info to client but log full traceback for debugging
        return Response({"error": "internal_server_error", "details": str(e)}, status=500)


@api_view(['POST'])
def delete_assignment(request):
    """
    Delete an assignment (instructor only).
    Body JSON: { assignment_id, instructor_id }
    Returns: { result: "deleted" } on success.
    """
    data = request.data
    assignment_id = data.get('assignment_id')
    instructor_id = data.get('instructor_id')
    if not assignment_id or not instructor_id:
        return Response({"error": "assignment_id and instructor_id are required"}, status=400)

    try:
        # fetch assignment to get course_db_id
        ass_resp = supabase.table('assignments').select('id, course_db_id').eq('id', assignment_id).execute()
        if getattr(ass_resp, 'error', None):
            return Response({"error": str(ass_resp.error)}, status=500)
        assignment = _single_from_resp(ass_resp)
        if not assignment:
            return Response({"error": "assignment_not_found"}, status=404)

        # verify instructor owns the course
        course_resp = supabase.table('courses').select('id, instructor_id').eq('id', assignment.get('course_db_id')).execute()
        if getattr(course_resp, 'error', None):
            return Response({"error": str(course_resp.error)}, status=500)
        course = _single_from_resp(course_resp)
        if not course:
            return Response({"error": "course_not_found"}, status=404)
        if str(course.get('instructor_id')) != str(instructor_id):
            return Response({"error": "forbidden"}, status=403)

        # perform delete
        del_resp = supabase.table('assignments').delete().eq('id', assignment_id).execute()
        if getattr(del_resp, 'error', None):
            return Response({"error": str(del_resp.error)}, status=500)

        return Response({"result": "deleted"}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
