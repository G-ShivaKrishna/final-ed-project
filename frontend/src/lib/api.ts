const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export async function fetchCourseResources(courseDbId: string | number, userId: string | null) {
	// ...returns array or [] on error
	try {
		const res = await fetch(`${API_BASE}/users/courses/resources/?course_db_id=${encodeURIComponent(String(courseDbId))}&user_id=${encodeURIComponent(String(userId ?? ''))}`);
		if (!res.ok) return [];
		return (await res.json()) || [];
	} catch {
		return [];
	}
}

export async function fetchCourseAssignments(courseDbId: string | number, userId: string | null) {
	try {
		const res = await fetch(`${API_BASE}/users/courses/assignments/?course_db_id=${encodeURIComponent(String(courseDbId))}&user_id=${encodeURIComponent(String(userId ?? ''))}`);
		if (!res.ok) return [];
		return (await res.json()) || [];
	} catch {
		return [];
	}
}

export async function fetchCourseSubmissions(courseDbId: string | number, instructorId: string | null) {
	// instructor-only: returns all submissions for the course assignments
	try {
		const res = await fetch(`${API_BASE}/users/courses/submissions/?course_db_id=${encodeURIComponent(String(courseDbId))}&instructor_id=${encodeURIComponent(String(instructorId ?? ''))}`);
		if (!res.ok) return [];
		return (await res.json()) || [];
	} catch {
		return [];
	}
}

export async function submitAssignmentBackend(studentId: string, assignmentId: string | number, fileUrl: string) {
	try {
		const res = await fetch(`${API_BASE}/users/courses/assignments/submit/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ student_id: studentId, assignment_id: assignmentId, file_url: fileUrl }),
		});
		return res;
	} catch (e) {
		throw e;
	}
}
