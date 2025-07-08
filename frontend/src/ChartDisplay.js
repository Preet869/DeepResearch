import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ScatterChart,
  Scatter
} from 'recharts';

const ChartDisplay = ({ graphData }) => {
  // State for chart type toggle - must be at the top before any early returns
  const [activeChartType, setActiveChartType] = useState(graphData?.type || 'bar');
  const [showAllData, setShowAllData] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Ref for chart container
  const chartRef = useRef(null);
  
  if (!graphData || !graphData.data || graphData.data.length === 0) {
    return null;
  }

  const { title, data, x_label, y_label, description, key_insight, why_matters, insight_type, ai_insights } = graphData;

  // Data processing for Top 5 limit
  const MAX_ITEMS = 5;
  const shouldLimitData = data.length > MAX_ITEMS && !showAllData;
  
  const processedData = shouldLimitData 
    ? (() => {
        // Sort data by value (descending) and take top 5
        const sortedData = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
        const topItems = sortedData.slice(0, MAX_ITEMS);
        const remainingItems = sortedData.slice(MAX_ITEMS);
        
        // Calculate "Others" value
        const othersValue = remainingItems.reduce((sum, item) => sum + (item.value || 0), 0);
        
        if (othersValue > 0) {
          return [...topItems, { name: `Others (${remainingItems.length})`, value: othersValue }];
        }
        return topItems;
      })()
    : data;

  const hiddenItemsCount = data.length - MAX_ITEMS;

  // Color palette for charts
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  // Get insight styling based on type
  const getInsightStyling = (type) => {
    switch (type) {
      case 'primary':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600'
        };
      case 'risk':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600'
        };
      case 'opportunity':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600'
        };
      case 'neutral':
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600'
        };
    }
  };

  const insightStyling = getInsightStyling(insight_type);

  // Export functions
  const exportChart = async (format = 'png') => {
    const chartContainer = document.querySelector('.chart-export-area');
    if (!chartContainer) return;
    
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(chartContainer, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        width: chartContainer.offsetWidth,
        height: chartContainer.offsetHeight,
      });
      
      if (format === 'png') {
        // Download as PNG
        const link = document.createElement('a');
        link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_chart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (format === 'svg') {
        // For SVG, we'll create a simple fallback since Recharts doesn't easily export SVG
        // In a real implementation, you might use a different charting library or custom SVG export
        alert('SVG export coming soon! PNG export is available now.');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderBarChart = () => {
    // Check if this is a comparison chart (has value2 data)
    const isComparisonChart = processedData.some(item => item.value2 !== undefined);
    
    if (isComparisonChart) {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={processedData}
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
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#F9FAFB', 
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              labelStyle={{ fontWeight: 'bold', color: '#374151' }}
              formatter={(value, name) => [
                typeof value === 'number' ? value.toLocaleString() : value,
                name === 'value' ? (graphData.article1_title || 'Article 1') : (graphData.article2_title || 'Article 2')
              ]}
              labelFormatter={(label) => `${x_label || 'Category'}: ${label}`}
            />
            <Legend />
            <Bar 
              dataKey="value" 
              name={graphData.article1_title || 'Article 1'}
              fill="#3B82F6" 
              radius={[4, 4, 0, 0]}
              stroke="#2563EB"
              strokeWidth={1}
            />
            <Bar 
              dataKey="value2" 
              name={graphData.article2_title || 'Article 2'}
              fill="#10B981" 
              radius={[4, 4, 0, 0]}
              stroke="#059669"
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    
    // Regular single-value bar chart
    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={processedData}
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
            interval={0}
            tick={{ fontSize: 11 }}
          />
          <YAxis 
            label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            fontSize={12}
            tick={{ fontSize: 11 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#F9FAFB', 
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            labelStyle={{ fontWeight: 'bold', color: '#374151' }}
            formatter={(value, name) => [
              typeof value === 'number' ? value.toLocaleString() : value,
              y_label || 'Value'
            ]}
            labelFormatter={(label) => `${x_label || 'Category'}: ${label}`}
          />
          <Bar 
            dataKey="value" 
            fill="#3B82F6" 
            radius={[4, 4, 0, 0]}
            stroke="#2563EB"
            strokeWidth={1}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={processedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {processedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#F9FAFB', 
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
                     formatter={(value, name) => [
             `${typeof value === 'number' ? value.toLocaleString() : value} (${((value / processedData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)`,
             y_label || 'Value'
           ]}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={350}>
             <LineChart
         data={processedData}
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
          label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          fontSize={12}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: '#F9FAFB', 
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          labelStyle={{ fontWeight: 'bold', color: '#374151' }}
          formatter={(value, name) => [
            typeof value === 'number' ? value.toLocaleString() : value,
            y_label || 'Value'
          ]}
          labelFormatter={(label) => `${x_label || 'Period'}: ${label}`}
        />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#3B82F6" 
          strokeWidth={3}
          dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderAreaChart = () => (
    <ResponsiveContainer width="100%" height={350}>
             <AreaChart
         data={processedData}
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
          label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          fontSize={12}
        />
                 <Tooltip 
           contentStyle={{ 
             backgroundColor: '#F9FAFB', 
             border: '1px solid #E5E7EB',
             borderRadius: '8px',
             boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
           }}
           labelStyle={{ fontWeight: 'bold', color: '#374151' }}
           formatter={(value, name) => [
             typeof value === 'number' ? value.toLocaleString() : value,
             y_label || 'Value'
           ]}
           labelFormatter={(label) => `${x_label || 'Period'}: ${label}`}
         />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#3B82F6" 
          fill="url(#colorGradient)"
          strokeWidth={2}
        />
        <defs>
          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderScatterChart = () => {
    // Transform data for scatter plot (assuming data has x, y values or we create them)
    const scatterData = processedData.map((item, index) => ({
      x: index + 1, // Use index as x-axis
      y: item.value,
      name: item.name
    }));

    return (
      <ResponsiveContainer width="100%" height={350}>
        <ScatterChart
          data={scatterData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            type="number"
            dataKey="x"
            name={x_label || 'Position'}
            label={{ value: x_label || 'Position', position: 'insideBottom', offset: -10 }}
            fontSize={12}
          />
          <YAxis 
            type="number"
            dataKey="y"
            name={y_label || 'Value'}
            label={{ value: y_label || 'Value', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            fontSize={12}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#F9FAFB', 
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            labelStyle={{ fontWeight: 'bold', color: '#374151' }}
            formatter={(value, name, props) => [
              typeof value === 'number' ? value.toLocaleString() : value,
              props.payload.name || y_label || 'Value'
            ]}
            labelFormatter={(label, payload) => 
              payload && payload[0] ? payload[0].payload.name : `${x_label || 'Point'}: ${label}`
            }
          />
          <Scatter 
            dataKey="y" 
            fill="#3B82F6"
            stroke="#2563EB"
            strokeWidth={2}
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    switch (activeChartType) {
      case 'bar':
        return renderBarChart();
      case 'pie':
        return renderPieChart();
      case 'line':
        return renderLineChart();
      case 'area':
        return renderAreaChart();
      case 'scatter':
        return renderScatterChart();
      default:
        return renderBarChart(); // Default to bar chart
    }
  };

  return (
    <div ref={chartRef} className="mt-6 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Story-Driven Insights */}
      {key_insight && (
        <div className={`mb-6 p-5 rounded-xl border-l-4 ${insightStyling.bgColor} ${insightStyling.borderColor} shadow-sm`}>
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${insightStyling.iconColor} text-xl`}>
              {insight_type === 'risk' && '⚠️'}
              {insight_type === 'opportunity' && '🚀'}
              {insight_type === 'primary' && '📈'}
              {(!insight_type || insight_type === 'neutral') && '📊'}
            </div>
            <div className="flex-1">
              <div className="mb-2">
                <span className={`text-xs font-medium uppercase tracking-wide ${insightStyling.textColor} opacity-60`}>
                  {insight_type === 'risk' && 'Risk Alert'}
                  {insight_type === 'opportunity' && 'Opportunity'}
                  {insight_type === 'primary' && 'Key Insight'}
                  {(!insight_type || insight_type === 'neutral') && 'Data Insight'}
                </span>
              </div>
              <p className={`text-lg font-bold ${insightStyling.textColor} leading-tight mb-1`}>
                {key_insight}
              </p>
              {why_matters && (
                <p className={`text-sm ${insightStyling.textColor} opacity-75 leading-relaxed`}>
                  <span className="font-medium">Why this matters:</span> {why_matters}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chart Title and Description */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-800 flex items-center">
            <span className="mr-2">📊</span>
            {title}
          </h3>
          
          <div className="flex items-center space-x-2">
            {/* Chart Type Toggle */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { type: 'bar', icon: '📊', label: 'Bar' },
                { type: 'pie', icon: '🥧', label: 'Pie' },
                { type: 'line', icon: '📈', label: 'Line' },
                { type: 'area', icon: '📉', label: 'Area' },
                { type: 'scatter', icon: '🔵', label: 'Scatter' }
              ].map(({ type: chartType, icon, label }) => (
                <button
                  key={chartType}
                  onClick={() => setActiveChartType(chartType)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-1 ${
                    activeChartType === chartType
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={`Switch to ${label} Chart`}
                >
                  <span className="text-xs">{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            
            {/* Export Button */}
            <div className="relative">
              <button
                onClick={() => exportChart('png')}
                disabled={isExporting}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"
                title="Export Chart"
              >
                {isExporting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Fullscreen Button */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
              title="View in Fullscreen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        </div>
        
        {description && (
          <p className="text-sm text-gray-600 italic">{description}</p>
        )}
      </div>
      
      {/* Chart */}
      <div className="bg-gray-50 rounded-lg p-4">
        {/* Export-only container - clean chart for export */}
        <div className="chart-export-area bg-white p-6 rounded-lg">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          {renderChart()}
        </div>
        
        {/* Show All Data Button */}
        {data.length > MAX_ITEMS && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAllData(!showAllData)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              {showAllData ? (
                <>
                  <span>📊</span>
                  <span>Show Top 5</span>
                </>
              ) : (
                <>
                  <span>📈</span>
                  <span>Show All {data.length} Items</span>
                  <span className="text-xs bg-blue-200 px-2 py-1 rounded-full">
                    +{hiddenItemsCount} more
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* AI Insights Panel */}
      {ai_insights && ai_insights.length > 0 && (
        <div className="mt-6 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🧠</span>
            AI-Generated Insights
          </h4>
          <div className="space-y-3">
            {ai_insights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-white rounded-lg border border-indigo-100">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm">
                  {index + 1}
                </div>
                <p className="text-gray-700 leading-relaxed text-sm">
                  {insight}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-500 italic">
            💡 These insights are AI-generated based on the chart data and research context
          </div>
        </div>
      )}
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">📊</span>
                  {title}
                </h2>
                {description && (
                  <p className="text-sm text-gray-600 mt-1">{description}</p>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Chart Type Toggle in Modal */}
                <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                  {[
                    { type: 'bar', icon: '📊', label: 'Bar' },
                    { type: 'pie', icon: '🥧', label: 'Pie' },
                    { type: 'line', icon: '📈', label: 'Line' },
                    { type: 'area', icon: '📉', label: 'Area' },
                    { type: 'scatter', icon: '🔵', label: 'Scatter' }
                  ].map(({ type: chartType, icon, label }) => (
                    <button
                      key={chartType}
                      onClick={() => setActiveChartType(chartType)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-1 ${
                        activeChartType === chartType
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      title={`Switch to ${label} Chart`}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                
                {/* Close Button */}
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200"
                  title="Close Fullscreen"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-auto">
              {/* Story-Driven Insights in Modal */}
              {key_insight && (
                <div className={`mb-6 p-6 rounded-xl border-l-4 ${insightStyling.bgColor} ${insightStyling.borderColor} shadow-sm`}>
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${insightStyling.iconColor} text-2xl`}>
                      {insight_type === 'risk' && '⚠️'}
                      {insight_type === 'opportunity' && '🚀'}
                      {insight_type === 'primary' && '📈'}
                      {(!insight_type || insight_type === 'neutral') && '📊'}
                    </div>
                    <div className="flex-1">
                      <div className="mb-2">
                        <span className={`text-sm font-medium uppercase tracking-wide ${insightStyling.textColor} opacity-60`}>
                          {insight_type === 'risk' && 'Risk Alert'}
                          {insight_type === 'opportunity' && 'Opportunity'}
                          {insight_type === 'primary' && 'Key Insight'}
                          {(!insight_type || insight_type === 'neutral') && 'Data Insight'}
                        </span>
                      </div>
                      <p className={`text-xl font-bold ${insightStyling.textColor} leading-tight mb-2`}>
                        {key_insight}
                      </p>
                      {why_matters && (
                        <p className={`text-base ${insightStyling.textColor} opacity-75 leading-relaxed`}>
                          <span className="font-medium">Why this matters:</span> {why_matters}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Large Chart */}
              <div className="bg-gray-50 rounded-lg p-6">
                <ResponsiveContainer width="100%" height={600}>
                  {activeChartType === 'bar' && (
                    <BarChart data={processedData} margin={{ top: 20, right: 30, left: 40, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="name" 
                        label={{ value: x_label, position: 'insideBottom', offset: -10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={14}
                        interval={0}
                      />
                      <YAxis 
                        label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        fontSize={14}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#F9FAFB', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          fontSize: '14px'
                        }}
                        labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                        formatter={(value, name) => [
                          typeof value === 'number' ? value.toLocaleString() : value,
                          y_label || 'Value'
                        ]}
                        labelFormatter={(label) => `${x_label || 'Category'}: ${label}`}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#3B82F6" 
                        radius={[6, 6, 0, 0]}
                        stroke="#2563EB"
                        strokeWidth={1}
                      />
                    </BarChart>
                  )}
                  
                  {activeChartType === 'pie' && (
                    <PieChart>
                      <Pie
                        data={processedData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        fontSize={14}
                      >
                        {processedData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#F9FAFB', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          fontSize: '14px'
                        }}
                        formatter={(value, name) => [
                          `${typeof value === 'number' ? value.toLocaleString() : value} (${((value / processedData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%)`,
                          y_label || 'Value'
                        ]}
                      />
                      <Legend wrapperStyle={{ paddingTop: '30px', fontSize: '14px' }} />
                    </PieChart>
                  )}
                  
                  {activeChartType === 'line' && (
                    <LineChart data={processedData} margin={{ top: 20, right: 30, left: 40, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="name" 
                        label={{ value: x_label, position: 'insideBottom', offset: -10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={14}
                      />
                      <YAxis 
                        label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        fontSize={14}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#F9FAFB', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          fontSize: '14px'
                        }}
                        labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                        formatter={(value, name) => [
                          typeof value === 'number' ? value.toLocaleString() : value,
                          y_label || 'Value'
                        ]}
                        labelFormatter={(label) => `${x_label || 'Period'}: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3B82F6" 
                        strokeWidth={4}
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, stroke: '#3B82F6', strokeWidth: 2 }}
                      />
                    </LineChart>
                  )}
                  
                  {activeChartType === 'area' && (
                    <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 40, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="name" 
                        label={{ value: x_label, position: 'insideBottom', offset: -10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        fontSize={14}
                      />
                      <YAxis 
                        label={{ value: y_label, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        fontSize={14}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#F9FAFB', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          fontSize: '14px'
                        }}
                        labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                        formatter={(value, name) => [
                          typeof value === 'number' ? value.toLocaleString() : value,
                          y_label || 'Value'
                        ]}
                        labelFormatter={(label) => `${x_label || 'Period'}: ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3B82F6" 
                        fill="url(#colorGradientModal)"
                        strokeWidth={3}
                      />
                      <defs>
                        <linearGradient id="colorGradientModal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  )}
                  
                  {activeChartType === 'scatter' && (
                    <ScatterChart
                      data={processedData.map((item, index) => ({
                        x: index + 1,
                        y: item.value,
                        name: item.name
                      }))}
                      margin={{ top: 20, right: 30, left: 40, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        type="number"
                        dataKey="x"
                        name={x_label || 'Position'}
                        label={{ value: x_label || 'Position', position: 'insideBottom', offset: -10 }}
                        fontSize={14}
                      />
                      <YAxis 
                        type="number"
                        dataKey="y"
                        name={y_label || 'Value'}
                        label={{ value: y_label || 'Value', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        fontSize={14}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#F9FAFB', 
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          fontSize: '14px'
                        }}
                        labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                        formatter={(value, name, props) => [
                          typeof value === 'number' ? value.toLocaleString() : value,
                          props.payload.name || y_label || 'Value'
                        ]}
                        labelFormatter={(label, payload) => 
                          payload && payload[0] ? payload[0].payload.name : `${x_label || 'Point'}: ${label}`
                        }
                      />
                      <Scatter 
                        dataKey="y" 
                        fill="#3B82F6"
                        stroke="#2563EB"
                        strokeWidth={2}
                      />
                    </ScatterChart>
                  )}
                </ResponsiveContainer>
                
                {/* Show All Data Button in Modal */}
                {data.length > MAX_ITEMS && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => setShowAllData(!showAllData)}
                      className="px-6 py-3 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
                    >
                      {showAllData ? (
                        <>
                          <span>📊</span>
                          <span>Show Top 5</span>
                        </>
                      ) : (
                        <>
                          <span>📈</span>
                          <span>Show All {data.length} Items</span>
                          <span className="text-xs bg-blue-200 px-2 py-1 rounded-full">
                            +{hiddenItemsCount} more
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                                 )}
               </div>
               
               {/* AI Insights in Modal */}
               {ai_insights && ai_insights.length > 0 && (
                 <div className="mt-8 p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                   <h4 className="text-xl font-semibold text-gray-900 mb-5 flex items-center">
                     <span className="mr-2">🧠</span>
                     AI-Generated Insights
                   </h4>
                   <div className="space-y-4">
                     {ai_insights.map((insight, index) => (
                       <div key={index} className="flex items-start space-x-4 p-4 bg-white rounded-lg border border-indigo-100">
                         <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-semibold text-indigo-600">
                           {index + 1}
                         </div>
                         <p className="text-gray-700 leading-relaxed">
                           {insight}
                         </p>
                       </div>
                     ))}
                   </div>
                   <div className="mt-5 text-sm text-gray-500 italic">
                     💡 These insights are AI-generated based on the chart data and research context
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default ChartDisplay; 