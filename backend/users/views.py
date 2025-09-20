from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import SupabaseUser, Course, CourseInvitation
from .serializers import CourseSerializer, CourseInvitationSerializer, SupabaseUserSerializer
import uuid
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from .permissions import IsInstructor, IsStudent

class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsInstructor]
    queryset = Course.objects.all()
    serializer_class = CourseSerializer

    def perform_create(self, serializer):
        instructor = self.request.user
        serializer.save(instructor=instructor)

    def get_queryset(self):
        user = self.request.user
        if user.role == 'instructor':
            return Course.objects.filter(instructor=user)
        return Course.objects.none()


class StudentListViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsInstructor]  # Only instructors can list students
    serializer_class = SupabaseUserSerializer

    def get_queryset(self):
        return SupabaseUser.objects.filter(role='student')


class CourseInvitationViewSet(viewsets.ModelViewSet):
    queryset = CourseInvitation.objects.all()
    serializer_class = CourseInvitationSerializer

    def get_permissions(self):
        if self.action == 'respond':
            permission_classes = [IsAuthenticated, IsStudent]  # Students respond
        else:
            permission_classes = [IsAuthenticated, IsInstructor]  # Instructors create/manage
        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        invitation_token = uuid.uuid4()
        invitation = serializer.save(invitation_token=invitation_token, sent_at=timezone.now())

        student_email = invitation.student.username  # adjust if your email field differs
        course_name = invitation.course.name
        invite_link = f"{settings.FRONTEND_URL}/invitations/accept?token={invitation_token}"

        send_mail(
            subject=f"Invitation to join course: {course_name}",
            message=f"You are invited to enroll in {course_name}. Click here to accept: {invite_link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[student_email],
            fail_silently=False,
        )

    @action(detail=False, methods=['post'])
    def respond(self, request):
        token = request.data.get('token')
        response = request.data.get('response')

        invitation = get_object_or_404(CourseInvitation, invitation_token=token)

        if invitation.status != 'pending':
            return Response({'detail': 'Already responded.'}, status=status.HTTP_400_BAD_REQUEST)

        if response not in ['accepted', 'declined']:
            return Response({'detail': 'Invalid response.'}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = response
        invitation.responded_at = timezone.now()
        invitation.save()
        return Response({'detail': f'Invitation {response}.'})
