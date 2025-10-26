from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.supabase_client import supabase


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
		resp = supabase.table('users').select('id, email, role').eq('username', username).single().execute()
		if getattr(resp, 'error', None):
			return Response({"error": str(resp.error)}, status=500)
		if not resp.data:
			return Response({"error": "not_found"}, status=404)
		return Response(resp.data)
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
		resp = supabase.table('users').select('id, email, username, role, created_at, "College", phone_number, major').eq('id', user_id).single().execute()
		if getattr(resp, 'error', None):
			return Response({"error": str(resp.error)}, status=500)
		if not resp.data:
			return Response({"error": "not_found"}, status=404)
		return Response(resp.data)
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
		assign_resp = supabase.table('assignments')
		assign_resp = assign_resp.select('*, course:courses(*)')
		assign_resp = assign_resp.in_('course_id', course_ids)
		assign_resp = assign_resp.order('due_date', {'ascending': True})
		assign_resp = assign_resp.execute()

		if getattr(assign_resp, 'error', None):
			return Response({"error": str(assign_resp.error)}, status=500)

		assignments = assign_resp.data or []

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

