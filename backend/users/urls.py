from django.urls import path
from . import views

urlpatterns = [
    path('test-supabase/', views.test_supabase),
    path('create-course/', views.create_course),
    path('join-course/', views.join_course),
    path('instructor-courses/', views.instructor_courses),
    path('ask/', views.ask_ai, name='ask_ai'),
]
