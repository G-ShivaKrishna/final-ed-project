from rest_framework.permissions import BasePermission

class IsInstructor(BasePermission):
    """
    Allows access only to users with role 'instructor'.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'instructor')

class IsStudent(BasePermission):
    """
    Allows access only to users with role 'student'.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'student')
