import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import './App.css'; 

const baseHourlyTemplate = [
  { hour: 8,  label: '8a',  baseWait: 2  },
  { hour: 9,  label: '9a',  baseWait: 3  },
  { hour: 10, label: '10a', baseWait: 5  },
  { hour: 11, label: '11a', baseWait: 4  },
  { hour: 12, label: '12p', baseWait: 14 },
  { hour: 13, label: '1p',  baseWait: 8  },
  { hour: 14, label: '2p',  baseWait: 4  },
  { hour: 15, label: '3p',  baseWait: 7  },
  { hour: 16, label: '4p',  baseWait: 5  },
  { hour: 17, label: '5p',  baseWait: 4  },
  { hour: 18, label: '6p',  baseWait: 2  },
];

const OPEN_HOUR  = 8;   
const CLOSE_HOUR = 18;  
const TOTAL_MINUTES = (CLOSE_HOUR - OPEN_HOUR) * 60; 

const historicalDataByDay = {
  0: [1,2,3,3,8,5,3,4,3,2,1],   
  1: [2,3,5,4,14,8,4,7,5,4,2],  
  2: [2,4,6,5,13,7,4,6,5,3,2],  
  3: [2,3,4,4,12,6,3,5,4,3,1],  
  4: [2,4,7,6,15,9,5,8,6,4,2],  
  5: [3,6,9,8,18,12,7,11,9,6,3],
  6: [1,4,5,4,10,6,4,5,4,3,1],  
};

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_ABBRS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CLOSED_DAYS = [0, 6]; 

function cosineInterpolate(y1, y2, fraction) {
  const f2 = (1 - Math.cos(fraction * Math.PI)) / 2;
  return y1 * (1 - f2) + y2 * f2;
}

function getInterpolatedWait(hoursArray, minuteOffset) {
  const currentFractionalHour = OPEN_HOUR + minuteOffset / 60;
  const firstHour = baseHourlyTemplate[0].hour;
  const lastHour  = baseHourlyTemplate[baseHourlyTemplate.length - 1].hour;

  if (currentFractionalHour <= firstHour) return hoursArray[0];
  if (currentFractionalHour >= lastHour)  return hoursArray[hoursArray.length - 1];

  for (let i = 0; i < baseHourlyTemplate.length - 1; i++) {
    const h0 = baseHourlyTemplate[i].hour;
    const h1 = baseHourlyTemplate[i + 1].hour;
    if (currentFractionalHour >= h0 && currentFractionalHour < h1) {
      const t = (currentFractionalHour - h0) / (h1 - h0);
      return cosineInterpolate(hoursArray[i], hoursArray[i + 1], t);
    }
  }
  return hoursArray[hoursArray.length - 1];
}

function formatMinuteLabel(offset) {
  const totalMin = OPEN_HOUR * 60 + offset;
  let h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

const hourlyTicks = baseHourlyTemplate.map(p => p.label);

function App() {
  const [currentDayStr, setCurrentDayStr] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [chartData, setChartData] = useState([]);
  const [feedbackStep, setFeedbackStep] = useState('initial');
  const [userRating, setUserRating] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen]   = useState(false);
  const [todayDayIndex, setTodayDayIndex]     = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);

  const [liveData] = useState({
    statusText: "More busy than usual",
    peopleCount: 4,
    waitTime: 6,
    bestTimes: ["2:30p", "5:30p"]
  });

  const buildGranularChartData = (dayIndex, dayType, currentHour, currentMinute, liveWaitTime) => {
    if (CLOSED_DAYS.includes(dayIndex)) return [];
    
    const hoursArray = historicalDataByDay[dayIndex] || baseHourlyTemplate.map(p => p.baseWait);
    const nowOffset = (currentHour - OPEN_HOUR) * 60 + currentMinute;
    const generatedPoints = [];

    // Calculate the difference between live data and what the model expected at this exact time
    const modelExpectedAtNow = getInterpolatedWait(hoursArray, nowOffset);
    const liveDiscrepancy = liveWaitTime - modelExpectedAtNow;

    for (let m = 0; m <= TOTAL_MINUTES; m++) {
      const displayLabel = formatMinuteLabel(m);
      const rawCalculatedWait = getInterpolatedWait(hoursArray, m);

      // ─── ELIMINATE THE SPIKE: Smooth blend neighborhood (45-minute window) ───
      let finalWaitValue = rawCalculatedWait;
      if (dayType === 'today') {
        const minutesFromNow = Math.abs(m - nowOffset);
        if (minutesFromNow <= 45) {
          // Linear bell curve modifier tapering down to 0 at the boundaries
          const blendFactor = (45 - minutesFromNow) / 45; 
          // Smoothly pull the trendline up/down toward the live value
          finalWaitValue = rawCalculatedWait + (liveDiscrepancy * blendFactor);
        }
      }

      const isExactHour = m % 60 === 0;
      const tickLabel = isExactHour ? baseHourlyTemplate[m / 60].label : displayLabel;

      if (dayType === 'today') {
        if (m < nowOffset) {
          generatedPoints.push({ time: tickLabel, wait: finalWaitValue, futureWait: null, displayTime: displayLabel });
        } else if (m === nowOffset) {
          // Perfectly shared intersection coordinate
          generatedPoints.push({ time: currentTimeStr, wait: finalWaitValue, futureWait: finalWaitValue, displayTime: currentTimeStr });
        } else {
          generatedPoints.push({ time: tickLabel, wait: null, futureWait: finalWaitValue, displayTime: displayLabel });
        }
      } else if (dayType === 'past') {
        generatedPoints.push({ time: tickLabel, wait: rawCalculatedWait, futureWait: null, displayTime: displayLabel });
      } else {
        generatedPoints.push({ time: tickLabel, wait: null, futureWait: rawCalculatedWait, displayTime: displayLabel });
      }
    }
    return generatedPoints;
  };

  useEffect(() => {
    const now = new Date();
    const todayIdx = now.getDay();
    setTodayDayIndex(todayIdx);
    setSelectedDayIndex(todayIdx);
    setCurrentDayStr(DAY_NAMES[todayIdx]);

    let currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const ampm = currentHour >= 12 ? 'pm' : 'am';
    currentHour = currentHour % 12 || 12;
    const minutesString = currentMinutes < 10 ? `0${currentMinutes}` : currentMinutes;
    const timeAnchorLabel = `${currentHour}:${minutesString}${ampm}`;
    setCurrentTimeStr(timeAnchorLabel);

    const points = buildGranularChartData(todayIdx, 'today', now.getHours(), now.getMinutes(), liveData.waitTime);
    setChartData(points);

    if (window.Notification && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, [liveData.waitTime]);

  useEffect(() => {
    if (selectedDayIndex === null) return;
    const now = new Date();
    const todayIdx = now.getDay();

    let currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const ampm = currentHour >= 12 ? 'pm' : 'am';
    currentHour = currentHour % 12 || 12;
    const minutesString = currentMinutes < 10 ? `0${currentMinutes}` : currentMinutes;
    const timeAnchorLabel = `${currentHour}:${minutesString}${ampm}`;

    let dayType = 'today';
    if (selectedDayIndex < todayIdx) dayType = 'past';
    else if (selectedDayIndex > todayIdx) dayType = 'future';

    const points = buildGranularChartData(selectedDayIndex, dayType, now.getHours(), now.getMinutes(), liveData.waitTime);
    setChartData(points);
    setCurrentDayStr(DAY_NAMES[selectedDayIndex]);
  }, [selectedDayIndex]);

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
    const googleFormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSc_aUyrCGT_MXDX9sCgTVqcNFG5T0B6Ar4J6zN1cHhegk9j6A/formResponse";
    
    const formData = new FormData();
    formData.append("entry.148537627", timestampDate);
    formData.append("entry.1726615638", timestampTime);
    formData.append("entry.484896489", rating);
    formData.append("entry.914361873", notes);

    fetch(googleFormUrl, { method: "POST", mode: "no-cors", body: formData })
    .then(() => console.log("Piped successfully."))
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

  const selectedDayType = selectedDayIndex === todayDayIndex ? 'today' : (selectedDayIndex < todayDayIndex ? 'past' : 'future');
  const isClosed = selectedDayIndex !== null && CLOSED_DAYS.includes(selectedDayIndex);
  const nowHour = new Date().getHours();
  const isViewingToday = selectedDayIndex === todayDayIndex;
  const outOfHours = isViewingToday && !isClosed && (nowHour < OPEN_HOUR || nowHour >= CLOSE_HOUR);
  const opensToday  = nowHour < OPEN_HOUR; 

  return (
    <div className="dashboard-container">
      <header className="app-header">
        <div className="brand-group">
          <h1 className="main-title">LineUp</h1>
          <p className="subtitle">ShakeSmart · Norris Student Center</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="notification-toggle" onClick={() => setDisclaimerOpen(true)} title="Privacy Info" style={{ fontSize: '20px' }}>⚠️</button>
          <button className="notification-toggle" onClick={toggleNotifications} aria-label="Toggle notifications">
            <span className="bell-icon" style={{ color: notificationsEnabled ? '#4e2a84' : '#666' }}>
              {notificationsEnabled ? '🔔' : '🔕'}
            </span>
          </button>
        </div>
      </header>

      <div className="day-selector-strip">
        {DAY_ABBRS.map((abbr, i) => {
          let pillType = 'future';
          if (CLOSED_DAYS.includes(i)) pillType = 'closed';
          else if (i < todayDayIndex) pillType = 'past';
          else if (i === todayDayIndex) pillType = 'today';
          return (
            <button
              key={abbr}
              className={`day-pill day-pill--${pillType}${i === selectedDayIndex ? ' day-pill--selected' : ''}`}
              onClick={() => setSelectedDayIndex(i)}
              aria-label={`View ${DAY_NAMES[i]}`}
            >
              <span className="day-pill__abbr">{abbr}</span>
              {i === todayDayIndex && <span className="day-pill__today-dot" />}
            </button>
          );
        })}
      </div>

      {outOfHours && (
        <div className="out-of-hours-banner">
          <span className="out-of-hours-icon">{opensToday ? '🕗' : '🔒'}</span>
          <div>
            <p className="out-of-hours-title">{opensToday ? "ShakeSmart isn’t open yet" : 'ShakeSmart is closed'}</p>
            <p className="out-of-hours-sub">
              {opensToday ? 'Opens today at 8:00 am — check back soon!' : 'Closed for today. Opens Monday–Friday, 8 am – 6 pm.'}
            </p>
          </div>
        </div>
      )}

      <main className="dashboard-grid">
        {isClosed ? (
          <section style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            <h2 style={{ color: '#4e2a84' }}>Closed on {currentDayStr}s</h2>
            <p>ShakeSmart is open Monday–Friday, 8 am – 6 pm.</p>
          </section>
        ) : (
          <>
            <section className="summary-column">
              <div className="day-banner">
                <span className="day-text">{selectedDayIndex === todayDayIndex ? `Today — ${currentDayStr}` : currentDayStr}</span>
                {selectedDayType === 'past' && <span className="day-type-badge day-type-badge--past">Historical</span>}
                {selectedDayType === 'future' && <span className="day-type-badge day-type-badge--future">Predicted</span>}
              </div>

              <div className="purple-card">
                <div className="live-indicator">
                  <span className="pulse-dot">🔘</span>
                  <span>{selectedDayType === 'today' ? `Live: ${liveData.statusText}` : selectedDayType === 'past' ? 'Historical data' : 'Forecast'}</span>
                </div>
                <h2 className="card-stats">
                  {selectedDayType === 'today'
                    ? `${liveData.peopleCount} people in line · ${liveData.waitTime} minute wait`
                    : selectedDayType === 'past'
                    ? `Avg wait: ${historicalDataByDay[selectedDayIndex]?.[4] ?? '—'} min at peak`
                    : `Est. peak wait: ~${historicalDataByDay[selectedDayIndex]?.[4] ?? '—'} min`}
                </h2>
              </div>

              <div className="section-container">
                <h3 className="section-title">BEST TIMES {selectedDayType === 'today' ? 'TODAY' : 'THAT DAY'}</h3>
                <div className="time-tag-container">
                  {liveData.bestTimes.map(time => <span key={time} className="time-tag">{time}</span>)}
                </div>
              </div>
            </section>

            <section className="chart-column">
              <div className="section-container card-wrapper-bg">
                <h3 className="section-title">
                  {selectedDayType === 'past' ? 'RECORDED WAIT TIMES' : selectedDayType === 'future' ? 'PREDICTED WAIT TIMES' : 'BUSY TIMES TODAY'}
                </h3>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4e2a84" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4e2a84" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="time" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#666', fontSize: 11 }} 
                        ticks={hourlyTicks}
                        interval={0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 11 }} unit="m" />
                      
                      <Tooltip 
                        labelFormatter={(value, items) => items[0]?.payload?.displayTime || value}
                        formatter={(value) => [`${Math.round(value)} min wait`]}
                        contentStyle={{ backgroundColor: '#4e2a84', borderRadius: '10px', color: '#fff' }} 
                        itemStyle={{ color: '#fff' }} 
                      />
                      
                      {selectedDayType === 'today' && (
                        <ReferenceLine x={currentTimeStr} stroke="#4e2a84" strokeWidth={1} strokeDasharray="3 3" />
                      )}
                      
                      <Area type="monotone" dataKey="wait" stroke="#4e2a84" strokeWidth={4} fill="url(#colorPurple)" dot={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="futureWait" stroke="#4e2a84" strokeWidth={3} strokeDasharray="6 6" fill="none" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="feedback-wrapper">
        <div className="feedback-inner">
          {feedbackStep === 'initial' && (
            <button onClick={() => setFeedbackStep('rating')} className="action-button">Would you like to give us feedback?</button>
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
              <p className="quiz-question">{userRating === 'Others' ? "Tell us what happened with your experience:" : "Tell us what happened (e.g. less staff, wrong estimation?)"}</p>
              <div className="text-submit-group">
                <textarea className="text-input-area" placeholder="Type your feedback here..." value={feedbackNotes} onChange={(e) => setFeedbackNotes(e.target.value)} rows={2} />
                <button onClick={handleTextNotesSubmit} className="submit-notes-button">Submit</button>
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

      {disclaimerOpen && (
        <div className="modal-backdrop" onClick={() => setDisclaimerOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 12px 0', color: '#4e2a84', fontSize: '20px', fontWeight: '700' }}>Privacy &amp; Transparency Disclaimer</h2>
            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#555', margin: '0 0 20px 0' }}>
              Estimates based on typical conditions:
              <ul style={{ textAlign: 'left', marginTop: '10px', paddingLeft: '20px', lineHeight: 1.8 }}>
                <li>Prediction model learns from past patterns.</li>
                <li>Predictions may not account for staffing changes or special events.</li>
                <li>No data stored about users.</li>
              </ul>
            </p>
            <button className="reset-button" onClick={() => setDisclaimerOpen(false)} style={{ backgroundColor: '#4e2a84', color: 'white', padding: '10px 24px' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;