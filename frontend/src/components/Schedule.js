import React, { useState, useEffect } from 'react';

const Schedule = ({ messages, onClose }) => {
  const [schedules, setSchedules] = useState([]);
  const [newSchedule, setNewSchedule] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    priority: 'medium',
    type: 'research'
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const scheduleTypes = [
    { id: 'all', name: 'All', icon: '📅' },
    { id: 'research', name: 'Research', icon: '🔬' },
    { id: 'review', name: 'Review', icon: '📖' },
    { id: 'writing', name: 'Writing', icon: '✍️' },
    { id: 'meeting', name: 'Meeting', icon: '🤝' }
  ];

  useEffect(() => {
    // Load existing schedules from localStorage
    const savedSchedules = localStorage.getItem('researchSchedules');
    if (savedSchedules) {
      setSchedules(JSON.parse(savedSchedules));
    }
  }, []);

  useEffect(() => {
    // Save schedules to localStorage whenever they change
    localStorage.setItem('researchSchedules', JSON.stringify(schedules));
  }, [schedules]);

  const handleAddSchedule = () => {
    if (!newSchedule.title || !newSchedule.date) return;

    const schedule = {
      id: Date.now(),
      ...newSchedule,
      createdAt: new Date().toISOString(),
      completed: false
    };

    setSchedules(prev => [...prev, schedule]);
    setNewSchedule({
      title: '',
      description: '',
      date: '',
      time: '',
      priority: 'medium',
      type: 'research'
    });
    setShowAddForm(false);
  };

  const handleDeleteSchedule = (id) => {
    setSchedules(prev => prev.filter(schedule => schedule.id !== id));
  };

  const handleToggleComplete = (id) => {
    setSchedules(prev => prev.map(schedule => 
      schedule.id === id ? { ...schedule, completed: !schedule.completed } : schedule
    ));
  };

  const handleEditSchedule = (id) => {
    const schedule = schedules.find(s => s.id === id);
    if (schedule) {
      setNewSchedule(schedule);
      setShowAddForm(true);
    }
  };

  const filteredSchedules = schedules.filter(schedule => {
    const matchesType = filterType === 'all' || schedule.type === filterType;
    return matchesType;
  });

  const sortedSchedules = filteredSchedules.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
    const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
    return dateA - dateB;
  });

  const getPriorityColor = (priority) => {
    const priorityMap = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return priorityMap[priority] || 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type) => {
    const typeMap = {
      research: '🔬',
      review: '📖',
      writing: '✍️',
      meeting: '🤝'
    };
    return typeMap[type] || '📅';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return '';
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Research Schedule</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filters and Add Button */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Type
              </label>
              <div className="flex flex-wrap gap-2">
                {scheduleTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setFilterType(type.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filterType === type.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{type.icon}</span>
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Schedule
              </button>
            </div>
          </div>

          {/* Add Schedule Form */}
          {showAddForm && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {newSchedule.id ? 'Edit Schedule' : 'Add New Schedule'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newSchedule.title}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Research task title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newSchedule.type}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="research">Research</option>
                    <option value="review">Review</option>
                    <option value="writing">Writing</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newSchedule.date}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newSchedule.priority}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newSchedule.description}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Description of the research task..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSchedule({
                      title: '',
                      description: '',
                      date: '',
                      time: '',
                      priority: 'medium',
                      type: 'research'
                    });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSchedule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {newSchedule.id ? 'Update' : 'Add'} Schedule
                </button>
              </div>
            </div>
          )}

          {/* Schedules List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Scheduled Tasks ({sortedSchedules.length})
              </h3>
            </div>

            {sortedSchedules.length > 0 ? (
              <div className="space-y-3">
                {sortedSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${
                      schedule.completed ? 'bg-gray-50 opacity-75' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getTypeIcon(schedule.type)}</span>
                          <h4 className={`font-medium ${schedule.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {schedule.title}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(schedule.priority)}`}>
                            {schedule.priority}
                          </span>
                        </div>
                        {schedule.description && (
                          <p className={`text-sm mb-2 ${schedule.completed ? 'text-gray-400' : 'text-gray-600'}`}>
                            {schedule.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{formatDate(schedule.date)}</span>
                          {schedule.time && <span>{formatTime(schedule.time)}</span>}
                          <span className="capitalize">{schedule.type}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleComplete(schedule.id)}
                          className={`p-1 rounded ${
                            schedule.completed
                              ? 'text-green-600 hover:text-green-700'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {schedule.completed ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditSchedule(schedule.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No scheduled tasks found.</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule; 