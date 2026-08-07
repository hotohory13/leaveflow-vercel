import { useState, useEffect } from 'react';
import Calendar from './Calendar';

// Timezone-safe date utilities
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatLocalDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Dashboard({ user, token, onLogout, addToast }) {
  const leaveTypeLabels = {
    sick: 'Sick Leave (مرضية)',
    vacation: 'Annual Leave (اعتيادية)',
    casual: 'Casual Leave (عرضة)',
    other: 'Other (آخرى)'
  };

  const [leaves, setLeaves] = useState([]);
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(new Date()));
  const [selectedDayLeave, setSelectedDayLeave] = useState(null);
  const [leaveType, setLeaveType] = useState('sick');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState('all');
  const [weekendModalData, setWeekendModalData] = useState(null);
  const [viewedMonth, setViewedMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const baseUrl = window.location.origin.includes('5173') 
    ? 'http://localhost:5000' 
    : window.location.origin;

  // Fetch all leaves on load
  const fetchLeaves = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/leaves`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load leaves');
      const data = await response.json();
      setLeaves(data);
    } catch (err) {
      console.error(err);
      addToast('Could not load leave records from server', 'error');
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  // Update selected leave details when calendar day selection changes or leaves list updates
  useEffect(() => {
    const leave = leaves.find(l => l.date === selectedDate);
    setSelectedDayLeave(leave || null);
  }, [selectedDate, leaves]);

  // Notify user when they navigate into a different academic year
  const prevAcademicYearRef = useState(() => {
    const now = new Date();
    const m = now.getMonth();
    return m >= 8 ? `${now.getFullYear()}/${now.getFullYear() + 1}` : `${now.getFullYear() - 1}/${now.getFullYear()}`;
  })[0];
  const [lastNotifiedYear, setLastNotifiedYear] = useState(prevAcademicYearRef);

  useEffect(() => {
    const { year, month } = viewedMonth;
    const academicLabel = month >= 8
      ? `${year}/${year + 1}`
      : `${year - 1}/${year}`;

    if (academicLabel !== lastNotifiedYear) {
      addToast(`📅 Now viewing Academic Year ${academicLabel}`, 'info');
      setLastNotifiedYear(academicLabel);
    }
  }, [viewedMonth]);

  // Determine current Academic Year bounds
  // Sept 1 to Aug 31
  const getAcademicYearBounds = (refDate = new Date()) => {
    const date = new Date(refDate);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed, Sept = 8

    let startYear, endYear;
    if (month >= 8) { // September to December
      startYear = year;
      endYear = year + 1;
    } else { // January to August
      startYear = year - 1;
      endYear = year;
    }

    return {
      start: `${startYear}-09-01`,
      end: `${endYear}-08-31`,
      label: `${startYear}/${endYear}`
    };
  };

  const getQuotaStatus = () => {
    // Use the calendar's currently viewed month to determine the academic year
    const refDate = new Date(viewedMonth.year, viewedMonth.month, 15);
    const today = new Date();
    const joinDate = new Date(user.startDate);
    const sixMonthsAfterJoin = new Date(joinDate);
    sixMonthsAfterJoin.setMonth(joinDate.getMonth() + 6);
    
    const isNewTrial = refDate < sixMonthsAfterJoin;
    
    let quotaLimit = 21;
    let relevantLeaves = [];
    let periodLabel = '';
    const trialEndDateStr = sixMonthsAfterJoin.toISOString().split('T')[0];

    if (isNewTrial) {
      quotaLimit = 3;
      periodLabel = `6-Month Trial (Ends ${trialEndDateStr})`;
      // Only count leaves within trial window
      relevantLeaves = leaves.filter(leave => {
        return leave.date >= user.startDate && leave.date <= trialEndDateStr;
      });
    } else {
      // Standard TA or Trial past 6 months
      const bounds = getAcademicYearBounds(refDate);
      periodLabel = `Academic Year ${bounds.label}`;
      
      // Count all leaves taken in the current academic year since employment start
      const startDateCheck = user.startDate > bounds.start ? user.startDate : bounds.start;

      relevantLeaves = leaves.filter(leave => {
        return leave.date >= startDateCheck && leave.date <= bounds.end;
      });
    }

    const taken = relevantLeaves.length;
    const remaining = quotaLimit - taken;
    const percentUsed = Math.min((taken / quotaLimit) * 100, 100);

    // Determine status color: Safe (Green) <= 60%, Warning (Orange) 60%-90%, Danger (Red) > 90%
    const ratio = taken / quotaLimit;
    let statusClass = 'text-green';
    let statusLabel = 'Safe';
    let ringColor = 'rgb(var(--color-green))';

    if (ratio >= 1.0) {
      statusClass = 'text-red';
      statusLabel = 'Exceeded';
      ringColor = 'rgb(var(--color-red))';
    } else if (taken >= Math.ceil(quotaLimit * 0.6)) {
      statusClass = 'text-orange';
      statusLabel = 'Warning';
      ringColor = 'rgb(var(--color-orange))';
    }

    return {
      limit: quotaLimit,
      taken,
      remaining,
      percentUsed,
      statusClass,
      statusLabel,
      ringColor,
      periodLabel,
      isTrial: isNewTrial,
      trialEndDate: trialEndDateStr
    };
  };

  const status = getQuotaStatus();

  // Add Leave Handler (performs weekend checks)
  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!selectedDate) {
      addToast('Please select a date', 'error');
      return;
    }

    // Check Weekend Spanning Policy (Egypt University HR rule: Thursday & Sunday off = Friday & Saturday count)
    const dateObj = parseLocalDate(selectedDate);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 4 = Thursday

    if (dayOfWeek === 4) { // Thursday
      const sundayDate = new Date(dateObj);
      sundayDate.setDate(dateObj.getDate() + 3);
      const sundayStr = formatLocalDate(sundayDate);
      const sundayLeave = leaves.find(l => l.date === sundayStr);

      if (sundayLeave) {
        const fridayDate = new Date(dateObj);
        fridayDate.setDate(dateObj.getDate() + 1);
        const fridayStr = formatLocalDate(fridayDate);

        const saturdayDate = new Date(dateObj);
        saturdayDate.setDate(dateObj.getDate() + 2);
        const saturdayStr = formatLocalDate(saturdayDate);

        setWeekendModalData({
          mainDate: selectedDate,
          otherDate: sundayStr,
          otherId: sundayLeave.id,
          fridayDate: fridayStr,
          saturdayDate: saturdayStr,
          mainType: 'Thursday',
          otherType: 'Sunday'
        });
        return; // Show modal warning instead of direct submit
      }
    } else if (dayOfWeek === 0) { // Sunday
      const thursdayDate = new Date(dateObj);
      thursdayDate.setDate(dateObj.getDate() - 3);
      const thursdayStr = formatLocalDate(thursdayDate);
      const thursdayLeave = leaves.find(l => l.date === thursdayStr);

      if (thursdayLeave) {
        const fridayDate = new Date(dateObj);
        fridayDate.setDate(dateObj.getDate() - 2);
        const fridayStr = formatLocalDate(fridayDate);

        const saturdayDate = new Date(dateObj);
        saturdayDate.setDate(dateObj.getDate() - 1);
        const saturdayStr = formatLocalDate(saturdayDate);

        setWeekendModalData({
          mainDate: selectedDate,
          otherDate: thursdayStr,
          otherId: thursdayLeave.id,
          fridayDate: fridayStr,
          saturdayDate: saturdayStr,
          mainType: 'Sunday',
          otherType: 'Thursday'
        });
        return; // Show modal warning instead of direct submit
      }
    }

    // Direct submit if no weekend spanning
    executeAddLeave('direct');
  };

  const executeAddLeave = async (mode) => {
    setLoading(true);
    
    try {
      if (mode === 'weekend' && weekendModalData) {
        const dataToSubmit = [
          { date: weekendModalData.mainDate, type: leaveType, reason: reason },
          { date: weekendModalData.fridayDate, type: leaveType, reason: 'Weekend Spanning (Thursday-Sunday Policy)' },
          { date: weekendModalData.saturdayDate, type: leaveType, reason: 'Weekend Spanning (Thursday-Sunday Policy)' }
        ];

        for (const item of dataToSubmit) {
          if (leaves.some(l => l.date === item.date)) continue;
          
          const response = await fetch(`${baseUrl}/api/leaves`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item)
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Failed to record leave on ${item.date}`);
          }
        }
        addToast('Recorded leaves for the selected day and weekend!', 'success');
      } 
      else if (mode === 'keep_new' && weekendModalData) {
        // 1. Delete existing other date leave
        const delResponse = await fetch(`${baseUrl}/api/leaves/${weekendModalData.otherId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!delResponse.ok) {
          const data = await delResponse.json();
          throw new Error(data.error || 'Failed to remove old leave record');
        }

        // 2. Insert new date leave
        const addResponse = await fetch(`${baseUrl}/api/leaves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ date: weekendModalData.mainDate, type: leaveType, reason: reason })
        });

        if (!addResponse.ok) {
          const data = await addResponse.json();
          throw new Error(data.error || 'Failed to record new leave');
        }

        addToast(`Kept only ${weekendModalData.mainType} leave (deleted ${weekendModalData.otherType}).`, 'success');
      } 
      else if (mode === 'keep_existing' && weekendModalData) {
        addToast(`New leave cancelled. Kept only existing ${weekendModalData.otherType} leave.`, 'info');
      } 
      else {
        // Standard direct submit
        const response = await fetch(`${baseUrl}/api/leaves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ date: selectedDate, type: leaveType, reason: reason })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to record leave');
        }
        addToast('Leave recorded successfully!', 'success');
      }

      setReason('');
      setWeekendModalData(null);
      fetchLeaves();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Leave Handler
  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to delete this leave record?')) return;
    
    try {
      const response = await fetch(`${baseUrl}/api/leaves/${leaveId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete record');
      }

      addToast('Leave record removed.', 'success');
      fetchLeaves();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Print/Export Report
  const handleExport = () => {
    window.print();
  };

  // Filter and search timeline logs
  const filteredLeaves = leaves.filter(leave => {
    const typeMatches = logFilter === 'all' || leave.type === logFilter;
    const searchMatches = leave.reason.toLowerCase().includes(logSearch.toLowerCase()) || 
                          leave.date.includes(logSearch) || 
                          leave.type.toLowerCase().includes(logSearch.toLowerCase());
    return typeMatches && searchMatches;
  });

  // Circle constants for radial progress
  const radius = 60;
  const stroke = 10;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (status.percentUsed / 100) * circumference;

  return (
    <div className="dashboard-container animate-fade-in">
      {/* Header */}
      <header className="dashboard-header glass-card">
        <div className="header-left">
          <div className="header-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2>LeaveFlow</h2>
          </div>
          <span className="divider"></span>
          <div className="user-summary">
            <span className="user-name">Welcome, <strong>{user.firstName}</strong></span>
            <span className="user-role-tag bg-primary-color">
              {status.isTrial ? 'New TA (Trial)' : 'Established TA'}
            </span>
          </div>
        </div>

        <div className="header-right">
          <div className="header-dates">
            <span className="date-label">Start Date: <span className="date-val">{user.startDate}</span></span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={handleExport} title="Print/Export Report">
            Export Report
          </button>
          <button type="button" className="btn btn-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Stats Row */}
      <div className="stats-row">
        {/* Radial Quota Card */}
        <div className="glass-card stat-card quota-meter-card">
          <div className="stat-radial-container">
            <svg height={radius * 2} width={radius * 2} className="radial-progress-svg">
              <circle
                stroke="rgba(255,255,255,0.05)"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke={status.ringColor}
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="progress-ring-circle"
              />
            </svg>
            <div className="stat-radial-text">
              <span className="radial-number">{status.taken}</span>
              <span className="radial-slash">/</span>
              <span className="radial-total">{status.limit}</span>
            </div>
          </div>
          <div className="stat-meta">
            <h4>Leave Quota Used</h4>
            <p className="period-label">{status.periodLabel}</p>
            {status.isTrial && (
              <span className="status-notice text-orange">Subject to 3-day trial limit</span>
            )}
          </div>
        </div>

        {/* Days Left Card */}
        <div className="glass-card stat-card">
          <div className="stat-numeric-header">
            <span className={`stat-number ${status.remaining < 0 ? 'text-red' : ''}`}>
              {status.remaining}
            </span>
            <span className="stat-unit">Days</span>
          </div>
          <div className="stat-meta">
            <h4>Leaves Remaining</h4>
            <p>{status.remaining < 0 ? 'Quota exceeded' : 'Available for use'}</p>
          </div>
        </div>

        {/* Status Alarm Card */}
        <div className="glass-card stat-card">
          <div className="stat-status-badge">
            <span className={`status-dot bg-${status.statusLabel.toLowerCase() === 'safe' ? 'green' : status.statusLabel.toLowerCase() === 'warning' ? 'orange' : 'red'}`}></span>
            <span className={`status-label ${status.statusClass}`}>{status.statusLabel}</span>
          </div>
          <div className="stat-meta">
            <h4>Quota Warning Level</h4>
            <p>
              {status.statusLabel === 'Safe' && 'You are within a safe threshold.'}
              {status.statusLabel === 'Warning' && 'Approaching leave allocation limits.'}
              {status.statusLabel === 'Exceeded' && 'Action Required: Limit exceeded.'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar on Left, Actions on Right */}
      <div className="dashboard-grid">
        <div className="grid-left-col">
          {/* Calendar */}
          <Calendar 
            leaves={leaves} 
            selectedDate={selectedDate} 
            onDateSelect={(date, leave) => {
              setSelectedDate(date);
              setSelectedDayLeave(leave || null);
            }}
            onMonthChange={(year, month) => {
              setViewedMonth({ year, month });
            }}
          />

          {/* Selected Day Details Panel */}
          <div className="glass-card day-details-card animate-slide-up">
            <div className="details-header">
              <h4>Day Focus: <span className="text-primary-color">{selectedDate}</span></h4>
            </div>
            {selectedDayLeave ? (
              <div className="details-content active-leave-details">
                <div className={`details-badge border-${selectedDayLeave.type}`}>
                  <span className="badge-bullet"></span>
                  <span className="badge-name">
                    {leaveTypeLabels[selectedDayLeave.type] || selectedDayLeave.type}
                  </span>
                </div>
                <div className="details-reason">
                  <span className="label">Comments / Notes:</span>
                  <p>{selectedDayLeave.reason || 'No comments left for this day.'}</p>
                </div>
                <button 
                  type="button" 
                  className="btn btn-danger w-full mt-3"
                  onClick={() => handleDeleteLeave(selectedDayLeave.id)}
                >
                  Delete Leave Record
                </button>
              </div>
            ) : (
              <div className="details-content no-leave-details">
                <p>No leave is recorded for this date.</p>
                <button 
                  type="button" 
                  className="btn btn-secondary w-full mt-3"
                  onClick={() => {
                    const formElement = document.getElementById('leave-submit-form');
                    if (formElement) {
                      formElement.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  Quick File Leave
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid-right-col">
          {/* Add Leave Form */}
          <div id="leave-submit-form" className="glass-card form-card">
            <h3>Record a Leave Day</h3>
            <p className="card-subtitle">File a leave day and specify category</p>
            <form onSubmit={handleAddLeave} className="dashboard-form">
              <div className="form-group">
                <label className="form-label" htmlFor="leaveDate">Date Selected</label>
                <input
                  id="leaveDate"
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="leaveTypeSelect">Leave Category</label>
                <select
                  id="leaveTypeSelect"
                  className="form-input form-select"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  required
                >
                  <option value="sick">Sick Leave (مرضية)</option>
                  <option value="vacation">Annual Leave (اعتيادية)</option>
                  <option value="casual">Casual Leave (عرضة)</option>
                  <option value="other">Other (آخرى)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="leaveReason">Notes / Comments (Optional)</label>
                <textarea
                  id="leaveReason"
                  className="form-input form-textarea"
                  placeholder="Provide context, cover info or medical details..."
                  rows="3"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={loading || !!selectedDayLeave}>
                {loading ? 'Submitting...' : selectedDayLeave ? 'Leave Already Exists' : 'Record Leave'}
              </button>
            </form>
          </div>

          {/* Leaves Log Timeline */}
          <div className="glass-card log-card">
            <div className="log-header-row">
              <div>
                <h3>Leave Log Timeline</h3>
                <p className="card-subtitle">History of recorded leaves</p>
              </div>
              <span className="log-badge-count">{filteredLeaves.length} items</span>
            </div>

            <div className="log-filters">
              <input
                type="text"
                placeholder="Search logs..."
                className="form-input search-input"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
              <select
                className="form-input filter-select"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="sick">Sick Leave (مرضية)</option>
                <option value="vacation">Annual Leave (اعتيادية)</option>
                <option value="casual">Casual Leave (عرضة)</option>
                <option value="other">Other (آخرى)</option>
              </select>
            </div>

            <div className="log-timeline-list">
              {filteredLeaves.length > 0 ? (
                filteredLeaves.map(leave => (
                  <div key={leave.id} className="timeline-item">
                    <div className={`timeline-indicator bg-${leave.type}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-top">
                        <span className="timeline-date">{leave.date}</span>
                        <div className="timeline-actions">
                          <span className={`timeline-type-tag tag-${leave.type}`}>
                            {leaveTypeLabels[leave.type] || leave.type}
                          </span>
                          <button
                            type="button"
                            className="timeline-delete-btn"
                            onClick={() => handleDeleteLeave(leave.id)}
                            title="Delete"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                      {leave.reason && <p className="timeline-reason">{leave.reason}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-logs">
                  <p>No leaves match the query parameters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weekend Spanning Warning Modal */}
      {weekendModalData && (() => {
        const potentialTotal = status.taken + 3;
        const exceededAmount = potentialTotal - status.limit;
        const isExceeding = potentialTotal > status.limit;
        
        return (
          <div className="modal-backdrop">
            <div className="modal-content glass-card animate-slide-up">
              <div className="modal-header">
                <span className="warning-icon">⚠️</span>
                <h3>Weekend Spanning Warning</h3>
              </div>
              
              <div className="modal-body">
                <p>
                  By Faculty Administration policy, taking leave on both <strong>{weekendModalData.mainType}</strong> and <strong>{weekendModalData.otherType}</strong> causes the weekend to count against your quota.
                </p>
                
                <div className="policy-explanation-box">
                  <div className="explanation-line">
                    <span className="bullet text-primary-color">●</span>
                    <span>Leave 1: {weekendModalData.mainDate} ({weekendModalData.mainType})</span>
                  </div>
                  <div className="explanation-line spanned-day text-orange">
                    <span className="bullet">●</span>
                    <span>Weekend Day 1: {weekendModalData.fridayDate} (Friday)</span>
                  </div>
                  <div className="explanation-line spanned-day text-orange">
                    <span className="bullet">●</span>
                    <span>Weekend Day 2: {weekendModalData.saturdayDate} (Saturday)</span>
                  </div>
                  <div className="explanation-line">
                    <span className="bullet text-primary-color">●</span>
                    <span>Leave 2: {weekendModalData.otherDate} ({weekendModalData.otherType})</span>
                  </div>
                </div>
                
                {isExceeding ? (
                  <p className="highlight-warning text-red" style={{ fontWeight: 'bold' }}>
                    ⚠️ Warning: Doing this will exceed your limit by {exceededAmount} day(s).
                  </p>
                ) : (
                  <p className="highlight-warning text-orange">
                    Notice: These weekend days (Friday and Saturday) will count against your remaining quota. Your total leaves will become {potentialTotal} days.
                  </p>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => executeAddLeave('weekend')}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Record with Weekend (Deduct 3 Days)'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => executeAddLeave('keep_new')}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : `Keep ${weekendModalData.mainType} Only (Delete ${weekendModalData.otherType})`}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => executeAddLeave('keep_existing')}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : `Keep ${weekendModalData.otherType} Only (Cancel ${weekendModalData.mainType})`}
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={() => setWeekendModalData(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Styled JSX for Dashboard structure details */}
      <style>{`
        .dashboard-container {
          max-width: 1300px;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-display);
          font-weight: 800;
          color: rgb(var(--color-primary));
        }

        .header-brand h2 {
          font-size: 1.45rem;
        }

        .divider {
          width: 1px;
          height: 1.75rem;
          background: var(--border-card);
        }

        .user-summary {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-name {
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .user-role-tag {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.15rem 0.55rem;
          border-radius: 100px;
          color: #040815;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .header-dates {
          font-size: 0.85rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-card);
          padding: 0.4rem 0.85rem;
          border-radius: var(--radius-sm);
        }

        .date-val {
          color: var(--text-primary);
          font-weight: 600;
        }

        /* Stats Row */
        .stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1.5rem;
        }

        .stat-card {
          display: flex;
          gap: 1.5rem;
          align-items: center;
        }

        .quota-meter-card {
          flex-grow: 1.2;
        }

        .stat-radial-container {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .radial-progress-svg {
          transform: rotate(-90deg);
          position: absolute;
          top: 0;
          left: 0;
        }

        .progress-ring-circle {
          transition: stroke-dashoffset 0.65s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .stat-radial-text {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-weight: 700;
        }

        .radial-number {
          font-size: 1.85rem;
          line-height: 1;
        }

        .radial-slash {
          font-size: 0.95rem;
          color: var(--text-dim);
          margin: 0 0.1rem;
        }

        .radial-total {
          font-size: 1.15rem;
          color: var(--text-muted);
          align-self: flex-end;
          margin-bottom: 0.15rem;
        }

        .stat-meta h4 {
          font-size: 1rem;
          margin-bottom: 0.2rem;
        }

        .stat-meta p {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .period-label {
          color: rgb(var(--color-primary)) !important;
          font-weight: 500;
        }

        .status-notice {
          font-size: 0.75rem;
          display: block;
          margin-top: 0.2rem;
          font-weight: 500;
        }

        .stat-numeric-header {
          display: flex;
          align-items: flex-end;
          gap: 0.25rem;
          line-height: 1;
        }

        .stat-number {
          font-family: var(--font-display);
          font-size: 3.25rem;
          font-weight: 800;
          color: rgb(var(--color-primary));
        }

        .stat-unit {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-dim);
          margin-bottom: 0.75rem;
        }

        .stat-status-badge {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-card);
          padding: 0.75rem 1.25rem;
          border-radius: var(--radius-sm);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          box-shadow: 0 0 10px currentColor;
        }

        .status-label {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.35rem;
          line-height: 1;
          letter-spacing: -0.01em;
        }

        /* Dashboard Grid Layout */
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 1.75rem;
          align-items: start;
        }

        .grid-left-col, .grid-right-col {
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }

        /* Selected Day details */
        .details-header {
          border-bottom: 1px solid var(--border-card);
          padding-bottom: 0.75rem;
          margin-bottom: 1rem;
        }

        .details-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .details-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          align-self: flex-start;
          padding: 0.4rem 0.85rem;
          border-radius: 100px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .border-sick { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .border-vacation { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .border-casual { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .border-other { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border: 1px solid rgba(139, 92, 246, 0.3); }

        .badge-bullet {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .details-reason .label {
          font-size: 0.8rem;
          color: var(--text-dim);
          display: block;
          margin-bottom: 0.25rem;
        }

        .details-reason p {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-card);
          padding: 0.85rem;
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.45;
          min-height: 50px;
        }

        .no-leave-details p {
          color: var(--text-muted);
          font-size: 0.9rem;
          text-align: center;
          padding: 1.5rem 0;
        }

        .mt-3 {
          margin-top: 0.75rem;
        }

        /* Form styling adjustments */
        .card-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: -0.25rem;
          margin-bottom: 1.25rem;
        }

        .dashboard-form {
          display: flex;
          flex-direction: column;
        }

        .form-textarea {
          font-family: var(--font-sans);
          resize: vertical;
        }

        /* Log timelines */
        .log-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.25rem;
        }

        .log-badge-count {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-card);
          padding: 0.2rem 0.6rem;
          border-radius: 100px;
          color: var(--text-muted);
          font-weight: 500;
        }

        .log-filters {
          display: grid;
          grid-template-columns: 2fr 1.1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .log-timeline-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 380px;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .timeline-item {
          display: flex;
          gap: 1rem;
          position: relative;
        }

        .timeline-item:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 5px;
          top: 15px;
          bottom: -15px;
          width: 1px;
          background: rgba(255, 255, 255, 0.06);
        }

        .timeline-indicator {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          margin-top: 5px;
          flex-shrink: 0;
          border: 2px solid var(--bg-main);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15);
        }

        .timeline-indicator.bg-sick { background-color: #ef4444; }
        .timeline-indicator.bg-vacation { background-color: #10b981; }
        .timeline-indicator.bg-casual { background-color: #f59e0b; }
        .timeline-indicator.bg-other { background-color: #8b5cf6; }

        .timeline-content {
          flex-grow: 1;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-sm);
          padding: 0.65rem 0.85rem;
        }

        .timeline-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .timeline-date {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .timeline-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .timeline-type-tag {
          font-size: 0.7rem;
          text-transform: capitalize;
          padding: 0.1rem 0.45rem;
          border-radius: 3px;
          font-weight: 600;
        }

        .tag-sick { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .tag-vacation { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .tag-casual { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .tag-other { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }

        .timeline-delete-btn {
          background: none;
          border: none;
          color: var(--text-dim);
          font-size: 1.15rem;
          cursor: pointer;
          line-height: 1;
          padding: 0 0.15rem;
          transition: color var(--transition-fast);
        }

        .timeline-delete-btn:hover {
          color: #ef4444;
        }

        .timeline-reason {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 0.35rem;
          border-left: 2px solid rgba(255, 255, 255, 0.08);
          padding-left: 0.5rem;
        }

        .empty-logs {
          color: var(--text-dim);
          font-size: 0.85rem;
          text-align: center;
          padding: 2rem 0;
        }

        /* Responsive */
        @media (max-width: 968px) {
          .stats-row {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
          .dashboard-header {
            padding: 1rem;
            flex-direction: column;
            align-items: flex-start;
          }
          .header-right {
            width: 100%;
            justify-content: space-between;
          }
          .divider {
            display: none;
          }
          .user-summary {
            margin-top: 0.25rem;
          }
        }

        /* Modal Overlay Styles */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(4, 7, 19, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1.5rem;
        }

        .modal-content {
          width: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid var(--border-card);
          padding-bottom: 0.75rem;
        }

        .warning-icon {
          font-size: 1.5rem;
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          font-size: 0.95rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .policy-explanation-box {
          background: rgba(255, 255, 255, 0.02);
          border-left: 3px solid rgb(var(--color-orange));
          padding: 1rem;
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .explanation-line {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-primary);
        }

        .bullet {
          font-size: 0.6rem;
        }

        .spanned-day {
          font-weight: 600;
        }

        .highlight-warning {
          font-size: 0.85rem;
          font-weight: 500;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          border-top: 1px solid var(--border-card);
          padding-top: 1rem;
          flex-wrap: wrap;
        }

        .modal-footer .btn {
          flex: 1 1 auto;
        }

        /* Print Media Styles */
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .dashboard-container {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .btn, .dashboard-form, .log-filters, .calendar-nav-buttons, .timeline-delete-btn, .details-content button, .user-summary button {
            display: none !important;
          }
          .glass-card {
            border: 1px solid #ccc !important;
            background: transparent !important;
            box-shadow: none !important;
            color: black !important;
            page-break-inside: avoid;
          }
          .stats-row {
            grid-template-columns: 1fr 1fr 1fr !important;
            color: black !important;
          }
          .stat-number {
            color: black !important;
          }
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .calendar-card {
            display: none !important;
          }
          .log-timeline-list {
            max-height: none !important;
            overflow: visible !important;
          }
          .timeline-content {
            border: 1px solid #ddd !important;
            color: black !important;
          }
          .timeline-date, .timeline-reason {
            color: black !important;
          }
          .status-label {
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
