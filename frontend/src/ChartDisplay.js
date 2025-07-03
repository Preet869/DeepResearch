import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const ChartDisplay = ({ graphData }) => {
  if (!graphData || !graphData.data || graphData.data.length === 0) {
    return null;
  }

  const { title, type, data, x_label, y_label, description } = graphData;

  // Color palette for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis 
          dataKey="name" 
          label={{ value: x_label, position: 'insideBottom', offset: -10 }}
          angle={-45}
          textAnchor="end"
          height={80}
          fontSize={12}
        />
        <YAxis 
          label={{ value: y_label, angle: -90, position: 'insideLeft' }}
          fontSize={12}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#F9FAFB', 
            border: '1px solid #E5E7EB',
            borderRadius: '6px'
          }}
        />
        <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#F9FAFB', 
            border: '1px solid #E5E7EB',
            borderRadius: '6px'
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return renderBarChart();
      case 'pie':
        return renderPieChart();
      default:
        return renderBarChart(); // Default to bar chart
    }
  };

  return (
    <div className="mt-6 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 italic">{description}</p>
        )}
      </div>
      {renderChart()}
    </div>
  );
};

export default ChartDisplay; 