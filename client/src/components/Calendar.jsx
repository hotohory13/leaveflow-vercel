import { useState } from 'react';

export default function Calendar({ leaves, onDateSelect, selectedDate, onMonthChange }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Month details
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get first day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Get total days in the current month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days in previous month
  const prevTotalDays = new Date(year, month, 0).getDate();

  const navigateMonth = (newDate) => {
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(newDate.getFullYear(), newDate.getMonth());
    }
  };

  const handlePrevMonth = () => {
    navigateMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    navigateMonth(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    navigateMonth(new Date());
  };

  // Find if a specific date has leave
  const getLeaveForDate = (day) => {
    // Format date as YYYY-MM-DD local time format
    const checkDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.find(leave => leave.date === checkDateStr);
  };

  // Render Days
  const renderDays = () => {
    const cells = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Fill previous month empty spaces
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDay = prevTotalDays - i;
      cells.push(
        <div key={`prev-${prevDay}`} className="calendar-day other-month">
          <span className="day-number">{prevDay}</span>
        </div>
      );
    }

    // Fill current month days
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const leave = getLeaveForDate(day);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;

      // Select leave class style
      let leaveClass = '';
      if (leave) {
        leaveClass = `has-leave leave-${leave.type}`;
      }

      cells.push(
        <div
          key={`day-${day}`}
          className={`calendar-day current-month ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${leaveClass}`}
          onClick={() => onDateSelect(dateStr, leave)}
        >
          <span className="day-number">{day}</span>
          {leave && (
            <div className="leave-badge-dot" title={`${leave.type}: ${leave.reason || 'No details'}`}></div>
          )}
        </div>
      );
    }

    // Fill next month empty spaces
    const totalCells = cells.length;
    const remainingCells = 42 - totalCells; // Standard 6-row grid
    for (let i = 1; i <= remainingCells; i++) {
      cells.push(
        <div key={`next-${i}`} className="calendar-day other-month">
          <span className="day-number">{i}</span>
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="calendar-card glass-card">
      <div className="calendar-header">
        <div className="calendar-title-nav">
          <h3>{monthNames[month]} {year}</h3>
          <div className="calendar-nav-buttons">
            <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth} title="Previous Month">
              &larr;
            </button>
            <button type="button" className="calendar-nav-btn today-btn" onClick={handleToday}>
              Month
            </button>
            <button type="button" className="calendar-nav-btn" onClick={handleNextMonth} title="Next Month">
              &rarr;
            </button>
          </div>
        </div>
        <div className="calendar-legend">
          <div className="legend-item"><span className="legend-dot bg-sick"></span>Sick (مرضية)</div>
          <div className="legend-item"><span className="legend-dot bg-vacation"></span>Annual (اعتيادية)</div>
          <div className="legend-item"><span className="legend-dot bg-casual"></span>Casual (عرضة)</div>
          <div className="legend-item"><span className="legend-dot bg-other"></span>Other (آخرى)</div>
        </div>
      </div>

      <div className="calendar-grid-header">
        {daysOfWeek.map(day => (
          <div key={day} className="grid-header-cell">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {renderDays()}
      </div>

      <style>{`
        .calendar-card {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .calendar-title-nav {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .calendar-title-nav h3 {
          font-size: 1.25rem;
          min-width: 150px;
        }

        .calendar-nav-buttons {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-card);
          padding: 0.2rem;
          border-radius: var(--radius-sm);
        }

        .calendar-nav-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          width: 2.25rem;
          height: 1.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 4px;
          transition: all var(--transition-fast);
          font-weight: 700;
        }

        .calendar-nav-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }

        .calendar-nav-btn.today-btn {
          width: auto;
          padding: 0 0.75rem;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .calendar-legend {
          display: flex;
          gap: 0.85rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .calendar-grid-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-dim);
          border-bottom: 1px solid var(--border-card);
          padding-bottom: 0.5rem;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        .calendar-day {
          aspect-ratio: 1.3;
          background: var(--bg-main);
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-end;
          cursor: pointer;
          position: relative;
          transition: all var(--transition-fast);
        }

        .calendar-day.current-month:hover {
          background: rgba(255, 255, 255, 0.02);
          z-index: 2;
        }

        .calendar-day.other-month {
          color: var(--text-dim);
          opacity: 0.35;
          cursor: default;
          pointer-events: none;
        }

        .day-number {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .calendar-day.today {
          border: 1.5px solid rgb(var(--color-primary));
        }

        .calendar-day.today .day-number {
          color: rgb(var(--color-primary));
          font-weight: 700;
        }

        .calendar-day.selected {
          box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.03);
        }

        .leave-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          align-self: flex-start;
          box-shadow: 0 0 8px currentColor;
        }

        /* Leave Types Highlighting Styles */
        .calendar-day.leave-sick {
          background: rgba(239, 68, 68, 0.07);
          color: #f87171;
        }
        .calendar-day.leave-sick:hover {
          background: rgba(239, 68, 68, 0.12) !important;
        }
        .calendar-day.leave-sick .leave-badge-dot {
          background-color: #ef4444;
          color: #ef4444;
        }

        .calendar-day.leave-vacation {
          background: rgba(16, 185, 129, 0.07);
          color: #34d399;
        }
        .calendar-day.leave-vacation:hover {
          background: rgba(16, 185, 129, 0.12) !important;
        }
        .calendar-day.leave-vacation .leave-badge-dot {
          background-color: #10b981;
          color: #10b981;
        }

        .calendar-day.leave-casual {
          background: rgba(245, 158, 11, 0.07);
          color: #fbbf24;
        }
        .calendar-day.leave-casual:hover {
          background: rgba(245, 158, 11, 0.12) !important;
        }
        .calendar-day.leave-casual .leave-badge-dot {
          background-color: #f59e0b;
          color: #f59e0b;
        }

        .calendar-day.leave-other {
          background: rgba(139, 92, 246, 0.07);
          color: #a78bfa;
        }
        .calendar-day.leave-other:hover {
          background: rgba(139, 92, 246, 0.12) !important;
        }
        .calendar-day.leave-other .leave-badge-dot {
          background-color: #8b5cf6;
          color: #8b5cf6;
        }

        /* Color classes for legend */
        .bg-sick { background-color: #ef4444; }
        .bg-vacation { background-color: #10b981; }
        .bg-casual { background-color: #f59e0b; }
        .bg-other { background-color: #8b5cf6; }

        @media (max-width: 540px) {
          .calendar-day {
            aspect-ratio: 1;
            padding: 0.25rem;
          }
          .day-number {
            font-size: 0.8rem;
          }
          .leave-badge-dot {
            width: 6px;
            height: 6px;
          }
          .calendar-title-nav h3 {
            font-size: 1.1rem;
            min-width: 110px;
          }
          .calendar-legend {
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
