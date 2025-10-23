from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.supabase_client import supabase

@api_view(['GET'])
def test_supabase(request):
    data = supabase.table('users').select('*').execute()
    return Response(data.data)

from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.supabase_client import supabase

@api_view(['POST'])
def create_course(request):
    data = request.data
    course_name = data.get('name')
    course_id = data.get('course_id')
    instructor_id = data.get('instructor_id')

    if not course_name or not course_id or not instructor_id:
        return Response({"error": "All fields are required"}, status=400)

    # Check if course_id already exists
    existing = supabase.table('courses').select('course_id').eq('course_id', course_id).execute()
    if existing.data and len(existing.data) > 0:
        return Response({"error": f"Course ID '{course_id}' already exists."}, status=400)

    # Insert into courses table
    try:
        result = supabase.table('courses').insert({
            "name": course_name,
            "course_id": course_id,
            "instructor_id": instructor_id
        }).execute()
    except Exception as e:
        if result.status_code != 201:
            return Response({"error": result.data}, status=400)

    return Response({"message": "Course created successfully"})

# lms/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from core.supabase_client import supabase

@api_view(['POST'])
def join_course(request):
    print("Received request.data type:", type(request.data))
    print("Received request.data:", request.data)
    data = request.data
    course_id = data.get('course_id')
    student_id = data.get('student_id')  # From JWT token or frontend

    if not course_id or not student_id:
        return Response({"error": "Both course_id and student_id are required"}, status=400)

    # 1️⃣ Check if the course exists
    course = supabase.table("courses").select("*").eq("course_id", course_id).execute()
    if not course.data or len(course.data) == 0:
        return Response({"error": f"Course ID '{course_id}' does not exist"}, status=404)

    # 2️⃣ Check if student already enrolled in this course
    enrollment = supabase.table("enrollments")\
        .select("*")\
        .eq("course_id", course_id)\
        .eq("student_id", student_id)\
        .execute()

    if enrollment.data and len(enrollment.data) > 0:
        return Response({"error": "Student already enrolled in this course"}, status=400)

    # 3️⃣ Insert student into enrollments
    try:
        result = supabase.table("enrollments").insert({
            "course_id": course_id,
            "student_id": student_id
        }).execute()
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    if not result.data or len(result.data) == 0:
        return Response({"error": "Failed to enroll student"}, status=400)

    return Response({"message": "Student successfully enrolled"})

@api_view(['GET'])
def instructor_courses(request):
    instructor_id = request.GET.get('instructor_id')
    if not instructor_id:
        return Response({"error": "Instructor ID is required"}, status=400)

    try:
        response = supabase.table('courses').select('*').eq('instructor_id', instructor_id).execute()
        courses = response.data if response.data else []
        return Response(courses)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
# chat/views.py
from django.http import JsonResponse
import requests

import json, requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# ✅ Replace with your valid OpenRouter key
import json, requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

API_KEY = "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"
DEEPSEEK_URL = "https://openrouter.ai/api/v1/chat/completions"

@csrf_exempt
def ask_ai(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)
    
    try:
        body = json.loads(request.body)
        prompt = body.get("prompt")
        if not prompt:
            return JsonResponse({"answer": "Prompt is required"}, status=400)

        # ✅ Correct headers — "Referer" (NOT "HTTP-Referer")
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "Referer": "http://localhost:3000",  # matches your frontend origin
            "X-Title": "My Django Chat App"
        }

        payload = {
            "model": "deepseek/deepseek-chat",
            "messages": [{"role": "user", "content": prompt}]
        }

        response = requests.post(DEEPSEEK_URL, headers=headers, json=payload)
        data = response.json()

        if "choices" in data and len(data["choices"]) > 0:
            answer = data["choices"][0]["message"]["content"]
            return JsonResponse({"answer": answer})
        elif "error" in data:
            return JsonResponse({"answer": f"Error: {data['error']['message']}"})
        else:
            return JsonResponse({"answer": "No response from AI."})
        
    except Exception as e:
        return JsonResponse({"answer": f"Server error: {str(e)}"}, status=500)
