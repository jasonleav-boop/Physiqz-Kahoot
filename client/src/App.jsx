import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import LoginRegister from './pages/LoginRegister';
import TutorDashboard from './pages/TutorDashboard';
import QuizEditor from './pages/QuizEditor';
import PresenterView from './pages/PresenterView';
import StudentView from './pages/StudentView';
import SessionReportView from './pages/SessionReportView';
import AttendanceDashboard from './pages/AttendanceDashboard';
import AttendancePresenterView from './pages/AttendancePresenterView';
import StudentAttendanceView from './pages/StudentAttendanceView';
import FacultyReportsView from './pages/FacultyReportsView';

export default function App() {
  const [tutor, setTutor] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('physics_kahoot_token') || '');
  const [activeTab, setActiveTab] = useState('quizzes'); // quizzes | create | edit | reports | attendance | presenter | student
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [activeRoomData, setActiveRoomData] = useState(null);
  const [hostSocket, setHostSocket] = useState(null);
  const [isStudentRoute, setIsStudentRoute] = useState(false);
  const [isAttendanceRoute, setIsAttendanceRoute] = useState(false);
  const [activeAttendanceSession, setActiveAttendanceSession] = useState(null);

  // Check initial URL route
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search;
    if (path.startsWith('/attend')) {
      setIsAttendanceRoute(true);
    } else if (path.startsWith('/join') || search.includes('room=') || search.includes('pin=')) {
      setIsStudentRoute(true);
    }
  }, []);

  // Check stored auth token on startup
  useEffect(() => {
    if (!token) return;
    const verifyToken = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.tutor) {
          setTutor(data.tutor);
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      }
    };
    verifyToken();
  }, [token]);

  const handleLoginSuccess = (tutorData, jwtToken) => {
    setTutor(tutorData);
    setToken(jwtToken);
    localStorage.setItem('physics_kahoot_token', jwtToken);
    setActiveTab('quizzes');
  };

  const handleLogout = () => {
    setTutor(null);
    setToken('');
    localStorage.removeItem('physics_kahoot_token');
    setActiveTab('quizzes');
    if (hostSocket) {
      hostSocket.disconnect();
      setHostSocket(null);
    }
  };

  // Launch live session for a quiz
  const handleStartSession = async (quiz, passcode = null, mode = 'LECTURER_PACED', totalTimeMinutes = 10) => {
    try {
      // Connect host socket
      const s = io({ transports: ['websocket', 'polling'] });
      setHostSocket(s);

      const doCreate = () => {
        // Fetch full quiz with questions
        fetch(`/api/quizzes/${quiz.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(fullQuiz => {
            s.emit('host:create-room', { tutorId: tutor.id, quiz: fullQuiz, passcode, mode, totalTimeMinutes }, (res) => {
              if (res.error) {
                alert(res.error);
                s.disconnect();
                return;
              }
              setActiveRoomData(res);
              setActiveTab('presenter');
            });
          })
          .catch(err => {
            alert('Failed to load quiz questions: ' + err.message);
            s.disconnect();
          });
      };

      if (s.connected) {
        doCreate();
      } else {
        s.once('connect', doCreate);
      }

      s.once('connect_error', (err) => {
        console.error('Socket connect error:', err);
        alert('Could not connect to session server: ' + err.message);
      });
    } catch (err) {
      alert('Error launching session: ' + err.message);
    }
  };

  const handleExitSession = () => {
    if (hostSocket) {
      hostSocket.disconnect();
      setHostSocket(null);
    }
    setActiveRoomData(null);
    setActiveTab('quizzes');
  };

  const handleOpenStudentView = () => {
    const pin = activeRoomData?.roomCode || '';
    const url = pin ? `/join?room=${pin}` : '/join';
    window.open(url, '_blank');
  };

  // Direct student attendance route (e.g. /attend or scanned QR code)
  if (isAttendanceRoute) {
    return (
      <StudentAttendanceView
        onGoToQuiz={() => {
          setIsAttendanceRoute(false);
          setIsStudentRoute(true);
        }}
      />
    );
  }

  // Direct student route (e.g. /join or scanned QR code)
  if (isStudentRoute || activeTab === 'student') {
    return (
      <StudentView
        onOpenTutorLogin={() => {
          setIsStudentRoute(false);
          setActiveTab('quizzes');
        }}
      />
    );
  }

  // If not logged in, show Tutor Login / Register
  if (!tutor) {
    return (
      <LoginRegister
        onLoginSuccess={handleLoginSuccess}
        onOpenStudentView={() => setIsStudentRoute(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Show Navbar except during full-screen Presenter Mode or Full-screen Attendance Presenter */}
      {activeTab !== 'presenter' && !activeAttendanceSession && (
        <Navbar
          tutor={tutor}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'create') setEditingQuizId(null);
            setActiveAttendanceSession(null);
            setActiveTab(tab);
          }}
          onLogout={handleLogout}
          onOpenStudentView={handleOpenStudentView}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {(activeTab === 'quizzes' || activeTab === 'dept-library') && (
          <TutorDashboard
            token={token}
            tutor={tutor}
            initialTab={activeTab === 'dept-library' ? 'dept-library' : 'my-quizzes'}
            onTabChange={(tab) => {
              if (tab === 'dept-library') setActiveTab('dept-library');
              else if (tab === 'my-quizzes') setActiveTab('quizzes');
            }}
            onStartSession={handleStartSession}
            onEditQuiz={(id) => {
              setEditingQuizId(id);
              setActiveTab('edit');
            }}
            onCreateQuiz={() => {
              setEditingQuizId(null);
              setActiveTab('create');
            }}
          />
        )}

        {(activeTab === 'create' || activeTab === 'edit') && (
          <QuizEditor
            quizId={editingQuizId}
            token={token}
            onSaveSuccess={() => {
              setActiveTab('quizzes');
              setEditingQuizId(null);
            }}
            onCancel={() => {
              setActiveTab('quizzes');
              setEditingQuizId(null);
            }}
          />
        )}

        {activeTab === 'reports' && (
          <SessionReportView
            token={token}
            onBack={() => setActiveTab('quizzes')}
          />
        )}

        {activeTab === 'attendance' && (
          activeAttendanceSession ? (
            <AttendancePresenterView
              sessionInfo={activeAttendanceSession}
              token={token}
              onBack={() => setActiveAttendanceSession(null)}
            />
          ) : (
            <AttendanceDashboard
              token={token}
              onStartAttendanceSession={(session) => setActiveAttendanceSession(session)}
            />
          )
        )}

        {activeTab === 'faculty' && (
          <FacultyReportsView
            token={token}
            tutor={tutor}
            onBack={() => setActiveTab('quizzes')}
          />
        )}

        {activeTab === 'presenter' && activeRoomData && hostSocket && (
          <PresenterView
            socket={hostSocket}
            initialRoomData={activeRoomData}
            onExitSession={handleExitSession}
          />
        )}
      </main>
    </div>
  );
}
