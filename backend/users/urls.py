from django.urls import path
from . import views

urlpatterns = [
    path('lookup-user/', views.lookup_user_by_username, name='lookup_user_by_username'),
    path('create-user/', views.create_user_record, name='create_user_record'),
    path('user-profile/', views.get_user_profile, name='get_user_profile'),
    path('user-profile/update/', views.update_user_profile, name='update_user_profile'),
    path('dashboard/', views.dashboard_summary, name='dashboard_summary'),
    path('ask/', views.ask, name='users_ask'),
    path('health/', views.health_check, name='health_check'),
    path('courses/create/', views.create_course, name='create_course'),
    path('courses/join-request/', views.create_join_request, name='create_join_request'),
    path('courses/requests/', views.list_join_requests, name='list_join_requests'),
    path('courses/requests/respond/', views.respond_join_request, name='respond_join_request'),
    path('courses/students/', views.list_enrolled_students, name='list_enrolled_students'),
    path('courses/delete/', views.delete_course, name='delete_course'),
    # assignments & submissions
    path('courses/assignments/create/', views.create_assignment, name='create_assignment'),
    path('courses/assignments/', views.list_course_assignments, name='list_course_assignments'),
    path('courses/assignments/submit/', views.submit_assignment, name='submit_assignment'),
    path('courses/submissions/grade/', views.grade_submission, name='grade_submission'),
    # course resources (syllabus / videos)
    path('courses/resources/add/', views.add_course_resource, name='add_course_resource'),
    path('courses/resources/', views.list_course_resources, name='list_course_resources'),
]
