import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Navbar from './components/Navbar';
import LoginRegister from './pages/LoginRegister';
import TutorDashboard from './pages/TutorDashboard';
import QuizEditor from './pages/QuizEditor';
import PresenterView from './pages/PresenterView';
import StudentView from './pages/StudentView';
import SessionReportView from './pages/SessionReportView';

export default function App() {
  const [tutor, setTutor] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('physics_kahoot_token') || '');
  const [activeTab, setActiveTab] = useState('quizzes'); // quizzes | create | edit | reports | presenter | student
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [activeRoomData, setActiveRoomData] = useState(null);
  const [hostSocket, setHostSocket] = useState(null);
  const [isStudentRoute, setIsStudentRoute] = useState(false);

  // Check initial URL route
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search;
    if (path.startsWith('/join') || search.includes('room=') || search.includes('pin=')) {
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
  const handleStartSession = async (quiz, passcode = null) => {
    try {
      // Connect host socket
      const s = io({ transports: ['websocket', 'polling'] });
      setHostSocket(s);

      s.on('connect', () => {
        // Fetch full quiz with questions
        fetch(`/api/quizzes/${quiz.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(fullQuiz => {
            s.emit('host:create-room', { tutorId: tutor.id, quiz: fullQuiz, passcode }, (res) => {
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

  // Direct student route (e.g. /join or scanned QR code)
  if (isStudentRoute || activeTab === 'student') {
    return <StudentView />;
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
      {/* Show Navbar except during full-screen Presenter Mode */}
      {activeTab !== 'presenter' && (
        <Navbar
          tutor={tutor}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'create') setEditingQuizId(null);
            setActiveTab(tab);
          }}
          onLogout={handleLogout}
          onOpenStudentView={handleOpenStudentView}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'quizzes' && (
          <TutorDashboard
            token={token}
            tutor={tutor}
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
