from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CourseViewSet, StudentListViewSet, CourseInvitationViewSet

router = DefaultRouter()
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'students', StudentListViewSet, basename='student')
router.register(r'course-invitations', CourseInvitationViewSet, basename='courseinvitation')

urlpatterns = [
    path('api/', include(router.urls)),
]
