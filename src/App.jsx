import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import './App.css'; 

const baseHourlyTemplate = [
  { hour: 9, label: '9a', baseWait: 3 },
  { hour: 10, label: '10a', baseWait: 5 },
  { hour: 11, label: '11a', baseWait: 4 },
  { hour: 12, label: '12p', baseWait: 14 },
  { hour: 1, label: '1p', baseWait: 8 },
  { hour: 2, label: '2p', baseWait: 4 },
  { hour: 3, label: '3p', baseWait: 7 },
  { hour: 4, label: '4p', baseWait: 5 },
  { hour: 5, label: '5p', baseWait: 4 },
];

function App() {
  const [currentDayStr, setCurrentDayStr] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [chartData, setChartData] = useState([]);
  const [feedbackStep, setFeedbackStep] = useState('initial');
  const [userRating, setUserRating] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [liveData] = useState({
    statusText: "More busy than usual",
    peopleCount: 4,
    waitTime: 6,
    bestTimes: ["2:30p", "5:30p"]
  });

  useEffect(() => {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    setCurrentDayStr(days[now.getDay()]);

    let currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const ampm = currentHour >= 12 ? 'pm' : 'am';
    currentHour = currentHour % 12;
    currentHour = currentHour ? currentHour : 12;
    const minutesString = currentMinutes < 10 ? `0${currentMinutes}` : currentMinutes;
    const timeAnchorLabel = `${currentHour}:${minutesString}${ampm}`;
    setCurrentTimeStr(timeAnchorLabel);

    const systemHourRaw = now.getHours();
    let generatedPoints = [];
    let liveCursorInserted = false;

    baseHourlyTemplate.forEach((point) => {
      const target24Hour = point.hour < 9 ? point.hour + 12 : point.hour;

      if (!liveCursorInserted && systemHourRaw < target24Hour) {
        generatedPoints.push({
          time: timeAnchorLabel,
          wait: liveData.waitTime,
          futureWait: liveData.waitTime
        });
        liveCursorInserted = true;
      }

      if (systemHourRaw >= target24Hour) {
        generatedPoints.push({
          time: point.label,
          wait: point.baseWait,
          futureWait: null
        });
      } else {
        generatedPoints.push({
          time: point.label,
          wait: null,
          futureWait: point.baseWait
        });
      }
    });

    if (!liveCursorInserted) {
      generatedPoints.push({
        time: timeAnchorLabel,
        wait: liveData.waitTime,
        futureWait: liveData.waitTime
      });
    }

    setChartData(generatedPoints);

    if (window.Notification && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, [liveData.waitTime]);

  const toggleNotifications = () => {
    if (!window.Notification) {
      alert("This browser does not support notifications.");
      return;
    }
    if (Notification.permission === "granted") {
      alert("Notifications are already enabled!");
      setNotificationsEnabled(true);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") {
          setNotificationsEnabled(true);
          new Notification("LineUp Enabled", { body: "Smart alerts are active!" });
        }
      });
    } else {
      alert("Please enable notification permissions in your browser settings.");
    }
  };

  const submitDataToSpreadsheet = (rating, notes) => {
    const timestampDate = new Date().toLocaleDateString();
    const timestampTime = new Date().toLocaleTimeString();

    const googleFormUrl = "https://google.com";
    
    const formData = new FormData();
    formData.append("entry.148537627", timestampDate);
    formData.append("entry.1726615638", timestampTime);
    formData.append("entry.484896489", rating);
    formData.append("entry.914361873", notes);

    fetch(googleFormUrl, {
      method: "POST",
      mode: "no-cors",
      body: formData 
    })
    .then(() => console.log("Piped successfully into cloud tracking columns."))
    .catch((e) => console.error("Sheet entry error logged:", e));
  };

  const handleRatingSelect = (selection) => {
    setUserRating(selection);
    if (selection === 'Accurate') {
      setFeedbackStep('thankyou');
      submitDataToSpreadsheet('Accurate', 'N/A');
    } else {
      setFeedbackStep('textFollowUp');
    }
  };

  const handleTextNotesSubmit = () => {
    setFeedbackStep('thankyou');
    submitDataToSpreadsheet(userRating, feedbackNotes);
  };

  return (
    <div className="dashboard-container">
      <header className="app-header">
        <div className="brand-group">
          <h1 className="main-title">LineUp</h1>
          <p className="subtitle">ShakeSmart · Norris Student Center</p>
        </div>
        <button className="notification-toggle" onClick={toggleNotifications} aria-label="Toggle notifications">
          <span className="bell-icon" style={{ color: notificationsEnabled ? '#4e2a84' : '#666' }}>
            {notificationsEnabled ? '🔔' : '🔕'}
          </span>
        </button>
      </header>

      <main className="dashboard-grid">
        <section className="summary-column">
          <div className="day-banner">
            <span className="day-text">Today — {currentDayStr}</span>
          </div>

          <div className="purple-card">
            <div className="live-indicator">
              <span className="pulse-dot">🔘</span>
              <span>Live: {liveData.statusText}</span>
            </div>
            <h2 className="card-stats">
              {liveData.peopleCount} people in line · {liveData.waitTime} minute wait
            </h2>
          </div>

          <div className="section-container">
            <h3 className="section-title">BEST TIMES TODAY</h3>
            <div className="time-tag-container">
              {liveData.bestTimes.map(time => (
                <span key={time} className="time-tag">{time}</span>
              ))}
            </div>
          </div>
        </section>

        <section className="chart-column">
          <div className="section-container card-wrapper-bg">
            <h3 className="section-title">BUSY TIMES TODAY</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4e2a84" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4e2a84" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 11 }} unit="m" />
                  <Tooltip contentStyle={{ backgroundColor: '#4e2a84', borderRadius: '10px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                  <ReferenceLine x={currentTimeStr} stroke="#4e2a84" strokeWidth={1} strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="wait" stroke="#4e2a84" strokeWidth={4} fill="url(#colorPurple)" dot={false} />
                  <Area type="monotone" dataKey="futureWait" stroke="#4e2a84" strokeWidth={3} strokeDasharray="6 6" fill="none" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </main>

      <footer className="feedback-wrapper">
        <div className="feedback-inner">
          {feedbackStep === 'initial' && (
            <button onClick={() => setFeedbackStep('rating')} className="action-button">
              Would you like to give us feedback?
            </button>
          )}

          {feedbackStep === 'rating' && (
            <div className="quiz-box">
              <p className="quiz-question">How accurate was this?</p>
              <div className="quiz-option-grid">
                <button onClick={() => handleRatingSelect('Accurate')} className="quiz-option">1. Accurate</button>
                <button onClick={() => handleRatingSelect('Somewhat Accurate')} className="quiz-option">2. Somewhat accurate</button>
                <button onClick={() => handleRatingSelect('Not Accurate')} className="quiz-option">3. Not accurate</button>
                <button onClick={() => handleRatingSelect('Others')} className="quiz-option">4. Others</button>
              </div>
            </div>
          )}

          {feedbackStep === 'textFollowUp' && (
            <div className="quiz-box">
              <p className="quiz-question">
                {userRating === 'Others' ? "Tell us what happened with your experience:" : "Tell us what happened (e.g. less staff, wrong estimation?)"}
              </p>
              <div className="text-submit-group">
                <textarea className="text-input-area" placeholder="Type your feedback here..." value={feedbackNotes} onChange={(e) => setFeedbackNotes(e.target.value)} rows={2} />
                <button onClick={handleTextNotesSubmit} className="submit-notes-button">
                  Submit
                </button>
              </div>
            </div>
          )}

          {feedbackStep === 'thankyou' && (
            <div className="thank-you-box">
              <p className="thank-you-text">Thank you for helping calibrate our predictive data modeling!</p>
              <button onClick={() => { setFeedbackStep('initial'); setUserRating(''); setFeedbackNotes(''); }} className="reset-button">Back</button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;