// Enhanced Analytics functionality for the Spelling Practice App

// Global analytics data
let analyticsData = null;
let selectedUser = 'all';
let selectedTimeRange = 'all';

// Initialize analytics components
document.addEventListener('DOMContentLoaded', function() {
  // Setup user selection dropdown events
  const userSelect = document.getElementById('analyticsUserSelect');
  if (userSelect) {
    userSelect.addEventListener('change', function() {
      selectedUser = this.value;
      renderAnalyticsDashboard();
    });
  }
  
  // Setup time range selection dropdown events
  const timeRangeSelect = document.getElementById('analyticsTimeRange');
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', function() {
      selectedTimeRange = this.value;
      renderAnalyticsDashboard();
    });
  }
});

// Main function to refresh analytics
async function analyticsRefresh() {
  // This is the main implementation
  console.log('📊 Refreshing analytics data...');
  try {
    // Update UI to show loading state
    updateLoadingState(true);
    
    // Fetch analytics data from server
    const response = await fetch('/getAnalytics');
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics data: ${response.status}`);
    }
    
    analyticsData = await response.json();
    
    // Populate user dropdown (now async)
    await populateUserDropdown();
    
    // Render the analytics dashboard with the new data
    renderAnalyticsDashboard();
    
    // Update UI to show data is loaded
    updateLoadingState(false);
    
    console.log('📊 Analytics data loaded successfully');
  } catch (error) {
    console.error('Error refreshing analytics:', error);
    updateLoadingState(false);
    
    // Show error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = 'Failed to load analytics data. Please try again.';
    
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
      container.innerHTML = '';
      container.appendChild(errorMessage.cloneNode(true));
    });
  }
}

// Update UI elements to show loading state
function updateLoadingState(isLoading) {
  const loadingTemplate = '<div class="loading-spinner"></div>';
  
  // Update stat cards
  document.getElementById('statTotalSessions').innerHTML = isLoading ? loadingTemplate : document.getElementById('statTotalSessions').innerHTML;
  document.getElementById('statOverallAccuracy').innerHTML = isLoading ? loadingTemplate : document.getElementById('statOverallAccuracy').innerHTML;
  document.getElementById('statTotalWords').innerHTML = isLoading ? loadingTemplate : document.getElementById('statTotalWords').innerHTML;
  document.getElementById('statAverageScore').innerHTML = isLoading ? loadingTemplate : document.getElementById('statAverageScore').innerHTML;
  
  // Update charts
  if (isLoading) {
    document.getElementById('progressChartContainer').innerHTML = loadingTemplate;
    document.getElementById('activityHeatmap').innerHTML = loadingTemplate;
    document.getElementById('problemWordsList').innerHTML = loadingTemplate;
    document.getElementById('userComparisonChart').innerHTML = loadingTemplate;
    document.getElementById('studentBreakdown').innerHTML = '<tr><td colspan="5" class="text-center">' + loadingTemplate + '</td></tr>';
    document.getElementById('recentActivityList').innerHTML = loadingTemplate;
  }
}

// Populate user dropdown with available users
async function populateUserDropdown() {
  console.log('🔄 Populating analytics user dropdown...');
  const userSelect = document.getElementById('analyticsUserSelect');
  if (!userSelect) {
    console.error('⚠️ Analytics user select dropdown not found in the DOM!');
    return;
  }
  
  // Check if we can use the shared admin users data
  if (typeof window.adminUsers !== 'undefined' && Array.isArray(window.adminUsers) && window.adminUsers.length > 0) {
    console.log('✅ Using shared admin users data:', window.adminUsers.map(u => u.username));
    
    // Clear existing options except the first one (All Users)
    console.log('Clearing existing options...');
    while (userSelect.options.length > 1) {
      userSelect.remove(1);
    }
    
    // Add users to dropdown
    window.adminUsers.forEach(user => {
      const option = document.createElement('option');
      option.value = user.username;
      option.textContent = user.username;
      userSelect.appendChild(option);
    });
    
    console.log(`✅ Added ${window.adminUsers.length} users to analytics dropdown`);
    return;
  }
  
  // If we can't use shared data, fetch from server
  try {
    // Clear existing options except the first one (All Users)
    console.log('Clearing existing options...');
    while (userSelect.options.length > 1) {
      userSelect.remove(1);
    }
    
    // Always fetch fresh users from server
    console.log("📥 Fetching users directly from server...");
    
    // Add a loading option
    const loadingOption = document.createElement('option');
    loadingOption.value = "";
    loadingOption.textContent = "Loading users...";
    loadingOption.disabled = true;
    userSelect.appendChild(loadingOption);
    
    const response = await fetch('/getUsers');
    console.log("GET /getUsers response:", response.status, response.statusText);
    
    // Remove loading option
    if (userSelect.contains(loadingOption)) {
      userSelect.removeChild(loadingOption);
    }
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    console.log("Raw server response:", responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''));
    
    let users = [];
    try {
      const allUsers = JSON.parse(responseText);
      console.log("Parsed users data:", allUsers);
      
      if (Array.isArray(allUsers)) {
        users = allUsers.map(user => user.username);
        console.log(`✅ Loaded ${users.length} users from server:`, users);
        
        if (users.length === 0) {
          console.warn("⚠️ Server returned empty users array!");
          
          // Add a warning option
          const warningOption = document.createElement('option');
          warningOption.value = "";
          warningOption.textContent = "No users found";
          warningOption.disabled = true;
          userSelect.appendChild(warningOption);
        }
      } else {
        console.error("❌ Server returned non-array data:", allUsers);
        throw new Error("Invalid user data format");
      }
    } catch (jsonError) {
      console.error("❌ Error parsing JSON response:", jsonError);
      throw jsonError;
    }
    
    // Add users to dropdown
    console.log(`Adding ${users.length} users to dropdown`);
    users.forEach(username => {
      const option = document.createElement('option');
      option.value = username;
      option.textContent = username;
      userSelect.appendChild(option);
    });
    console.log('✅ User dropdown populated successfully');
  } catch (error) {
    console.error("❌ Error populating user dropdown:", error);
  }
}

// Render the entire analytics dashboard
function renderAnalyticsDashboard() {
  if (!analyticsData) {
    console.warn('No analytics data available to render');
    return;
  }
  
  // Filter data based on selected user and time range
  const filteredData = filterAnalyticsData();
  
  // Update summary statistics
  updateSummaryStats(filteredData);
  
  // Render progress chart
  renderProgressChart(filteredData);
  
  // Render activity heatmap
  renderActivityHeatmap(filteredData);
  
  // Render problem words list
  renderProblemWordsList(filteredData);
  
  // Render user comparison chart
  renderUserComparisonChart(filteredData);
  
  // Render student breakdown table
  renderStudentBreakdownTable(filteredData);
  
  // Render recent activity feed
  renderRecentActivityFeed(filteredData);
}

// Filter analytics data based on selected user and time range
function filterAnalyticsData() {
  if (!analyticsData) return null;
  
  // Clone the data to avoid modifying the original
  const filtered = JSON.parse(JSON.stringify(analyticsData));
  
  // Filter by user if not 'all'
  if (selectedUser !== 'all') {
    // Keep only the selected user's data
    filtered.userStats = {
      [selectedUser]: filtered.userStats[selectedUser]
    };
  }
  
  // Filter by time range
  if (selectedTimeRange !== 'all') {
    const cutoffDate = getTimeRangeCutoffDate();
    
    // Filter activity dates
    Object.keys(filtered.summary.activityByDate).forEach(date => {
      if (new Date(date) < cutoffDate) {
        delete filtered.summary.activityByDate[date];
      }
    });
    
    // Filter user trends
    Object.keys(filtered.userStats).forEach(username => {
      const user = filtered.userStats[username];
      if (user.trend) {
        user.trend = user.trend.filter(item => new Date(item.date) >= cutoffDate);
      }
      if (user.recentResults) {
        user.recentResults = user.recentResults.filter(item => new Date(item.date) >= cutoffDate);
      }
    });
  }
  
  return filtered;
}

// Get cutoff date based on selected time range
function getTimeRangeCutoffDate() {
  const now = new Date();
  switch (selectedTimeRange) {
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'quarter':
      return new Date(now.setMonth(now.getMonth() - 3));
    default:
      return new Date(0); // Beginning of time
  }
}

// Update summary statistics cards
function updateSummaryStats(data) {
  if (!data) return;
  
  // Calculate summary stats based on filtered data
  let totalSessions = 0;
  let totalWords = 0;
  let totalCorrect = 0;
  
  // If we're viewing a single user
  if (selectedUser !== 'all' && data.userStats[selectedUser]) {
    const userData = data.userStats[selectedUser];
    totalSessions = userData.totalSessions || 0;
    totalWords = userData.totalWords || 0;
    totalCorrect = userData.correctWords || 0;
  } 
  // Otherwise use summary data
  else {
    // Count sessions from activity data
    totalSessions = Object.values(data.summary.activityByDate || {}).reduce((sum, count) => sum + count, 0);
    
    // Count words from all users
    Object.values(data.userStats || {}).forEach(user => {
      totalWords += user.totalWords || 0;
      totalCorrect += user.correctWords || 0;
    });
  }
  
  // Calculate accuracy and average
  const accuracy = totalWords > 0 ? (totalCorrect / totalWords * 100).toFixed(1) : 0;
  const averageScore = totalSessions > 0 ? (totalCorrect / totalSessions).toFixed(1) : 0;
  
  // Update UI
  document.getElementById('statTotalSessions').textContent = totalSessions;
  document.getElementById('statOverallAccuracy').textContent = `${accuracy}%`;
  document.getElementById('statTotalWords').textContent = totalWords;
  document.getElementById('statAverageScore').textContent = averageScore;
}

// Render the progress over time chart
function renderProgressChart(data) {
  const container = document.getElementById('progressChartContainer');
  if (!container || !data) return;
  
  // Clear previous chart
  container.innerHTML = '';
  
  // Get trend data
  let trendData = [];
  
  if (selectedUser !== 'all' && data.userStats[selectedUser]) {
    // Get trend for specific user
    trendData = data.userStats[selectedUser].trend || [];
  } else {
    // Aggregate trends from all users
    Object.values(data.userStats || {}).forEach(user => {
      if (user.trend && user.trend.length) {
        // Group by date and average the accuracy
        user.trend.forEach(item => {
          const existingItem = trendData.find(t => t.date === item.date);
          if (existingItem) {
            existingItem.totalAccuracy += item.accuracy;
            existingItem.count++;
          } else {
            trendData.push({
              date: item.date,
              totalAccuracy: item.accuracy,
              count: 1
            });
          }
        });
      }
    });
    
    // Calculate average accuracy for each date
    trendData = trendData.map(item => ({
      date: item.date,
      accuracy: item.totalAccuracy / item.count
    }));
    
    // Sort by date
    trendData.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  
  if (trendData.length === 0) {
    container.innerHTML = '<div class="empty-state">No progress data available</div>';
    return;
  }
  
  // Create SVG
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.overflow = 'hidden';
  container.appendChild(svg);
  
  // Create a clipping path to ensure chart doesn't go outside boundaries
  const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.setAttribute('id', 'progress-chart-area');
  const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  clipRect.setAttribute('x', padding.left);
  clipRect.setAttribute('y', padding.top);
  clipRect.setAttribute('width', chartWidth);
  clipRect.setAttribute('height', chartHeight);
  clipPath.appendChild(clipRect);
  svgDefs.appendChild(clipPath);
  
  // Add a group for all chart elements that should be clipped
  const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  chartGroup.setAttribute('clip-path', 'url(#progress-chart-area)');
  svg.appendChild(chartGroup);
  svg.appendChild(svgDefs);
  
  // Scale functions with boundary checks
  const xScale = index => {
    // Ensure index is within bounds
    const safeIndex = Math.max(0, Math.min(index, trendData.length - 1));
    return (safeIndex / (trendData.length - 1 || 1)) * chartWidth + padding.left;
  };
  
  const yScale = value => {
    // Ensure score is within 0-100 range
    const safeValue = Math.max(0, Math.min(value, 100));
    return chartHeight - (safeValue / 100) * chartHeight + padding.top;
  };
  
  // Smooth out the data to prevent sudden drops
  const smoothedData = [...trendData];
  
  // Apply simple moving average to smooth out sudden drops
  if (smoothedData.length > 2) {
    for (let i = 1; i < smoothedData.length - 1; i++) {
      const prevAccuracy = smoothedData[i-1].accuracy || 0;
      const currAccuracy = smoothedData[i].accuracy || 0;
      const nextAccuracy = smoothedData[i+1].accuracy || 0;
      
      // If there's a large drop (over 30%), smooth it out
      if (currAccuracy < prevAccuracy - 30 && currAccuracy < nextAccuracy - 30) {
        smoothedData[i].accuracy = (prevAccuracy + nextAccuracy) / 2;
      }
    }
  }
  
  // Create path for the line
  const pathData = smoothedData.map((point, i) => {
    // Ensure we have valid coordinates
    const x = xScale(i);
    const y = yScale(point.accuracy || 0);
    
    // Skip invalid coordinates
    if (isNaN(x) || isNaN(y)) {
      console.warn('Invalid coordinate for progress chart:', { x, y, point, i });
      return '';
    }
    
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).filter(segment => segment !== '').join(' ');
  
  // Only render if we have valid path data
  if (pathData && pathData.length > 0 && !pathData.includes('NaN')) {
    // Add the path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', 'var(--primary)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    chartGroup.appendChild(path);
    
    // Add area under the curve
    try {
      const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const lastValidIndex = trendData.length - 1;
      const areaPathData = `${pathData} L ${xScale(lastValidIndex).toFixed(1)} ${(chartHeight + padding.top).toFixed(1)} L ${xScale(0).toFixed(1)} ${(chartHeight + padding.top).toFixed(1)} Z`;
      
      if (areaPathData && !areaPathData.includes('NaN')) {
        areaPath.setAttribute('d', areaPathData);
        areaPath.setAttribute('fill', 'var(--primary)');
        areaPath.setAttribute('opacity', '0.1');
        chartGroup.appendChild(areaPath);
      }
    } catch (error) {
      console.error('Error creating area path:', error);
    }
  } else {
    console.warn('Unable to create valid path data for progress chart');
  }
  
  // Add data points
  trendData.forEach((point, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', xScale(i));
    circle.setAttribute('cy', yScale(point.accuracy || 0));
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', 'var(--primary)');
    
    // Add tooltip data
    circle.setAttribute('data-date', point.date);
    circle.setAttribute('data-accuracy', `${Math.round(point.accuracy || 0)}%`);
    
    // Add event listeners for tooltip
    circle.addEventListener('mouseenter', showTooltip);
    circle.addEventListener('mouseleave', hideTooltip);
    
    chartGroup.appendChild(circle);
  });
  
  // Add axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  xAxis.setAttribute('x1', padding.left);
  xAxis.setAttribute('y1', chartHeight + padding.top);
  xAxis.setAttribute('x2', chartWidth + padding.left);
  xAxis.setAttribute('y2', chartHeight + padding.top);
  xAxis.setAttribute('stroke', '#ccc');
  svg.appendChild(xAxis);
  
  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  yAxis.setAttribute('x1', padding.left);
  yAxis.setAttribute('y1', padding.top);
  yAxis.setAttribute('x2', padding.left);
  yAxis.setAttribute('y2', chartHeight + padding.top);
  yAxis.setAttribute('stroke', '#ccc');
  svg.appendChild(yAxis);
  
  // Add Y-axis labels (0%, 50%, 100%)
  [0, 50, 100].forEach(value => {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', padding.left - 5);
    label.setAttribute('y', yScale(value));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-size', '10px');
    label.setAttribute('fill', 'var(--text-secondary)');
    label.textContent = `${value}%`;
    svg.appendChild(label);
  });
  
  // Add X-axis labels (dates)
  if (trendData.length > 0) {
    [0, Math.floor(trendData.length / 2), trendData.length - 1].forEach(i => {
      if (i < trendData.length) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', xScale(i));
        label.setAttribute('y', chartHeight + padding.top + 15);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '10px');
        label.setAttribute('fill', 'var(--text-secondary)');
        
        // Format date for display
        const date = new Date(trendData[i].date);
        label.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        
        svg.appendChild(label);
      }
    });
  }
}

// Show tooltip for chart data points
function showTooltip(event) {
  // Get tooltip element or create one if it doesn't exist
  let tooltip = document.querySelector('.chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
  }
  
  // Get data from the point
  const date = this.getAttribute('data-date');
  const accuracy = this.getAttribute('data-accuracy');
  
  // Format the content
  tooltip.innerHTML = `
    <div><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</div>
    <div><strong>Accuracy:</strong> ${accuracy}</div>
  `;
  
  // Position the tooltip
  const rect = this.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate initial position
  let left = rect.left;
  let top = rect.top - tooltip.offsetHeight - 10;
  
  // Adjust to keep tooltip within viewport
  if (left + tooltip.offsetWidth > viewportWidth) {
    left = viewportWidth - tooltip.offsetWidth - 10;
  }
  
  if (top < 0) {
    // If not enough space above, position below
    top = rect.bottom + 10;
  }
  
  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${Math.max(10, top)}px`;
  
  // Show the tooltip
  tooltip.style.opacity = '1';
}

// Hide tooltip for chart data points
function hideTooltip() {
  const tooltip = document.querySelector('.chart-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
  }
}

// Render activity heatmap
function renderActivityHeatmap(data) {
  const container = document.getElementById('activityHeatmap');
  if (!container || !data) return;
  
  // Clear previous content
  container.innerHTML = '';
  
  // Get activity data
  const activityData = data.summary.activityByDate || {};
  
  // If no data, show empty state
  if (Object.keys(activityData).length === 0) {
    container.innerHTML = '<div class="empty-state">No activity data available</div>';
    return;
  }
  
  // Create container for heatmap
  const heatmapContainer = document.createElement('div');
  heatmapContainer.className = 'heatmap';
  container.appendChild(heatmapContainer);
  
  // Get date range (last 90 days)
  const today = new Date();
  const days = [];
  for (let i = 90; i >= 0; i--) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  
  // Find max activity count for color scaling
  const maxCount = Math.max(...Object.values(activityData).map(count => count || 0), 1);
  
  // Create day elements
  days.forEach(day => {
    const count = activityData[day] || 0;
    const intensity = count / maxCount;
    
    const dayEl = document.createElement('div');
    dayEl.className = 'heatmap-day';
    dayEl.style.backgroundColor = getHeatColor(intensity);
    dayEl.setAttribute('data-date', day);
    dayEl.setAttribute('data-count', count);
    
    // Add tooltip
    dayEl.addEventListener('mouseenter', function(e) {
      const date = new Date(this.getAttribute('data-date')).toLocaleDateString();
      const count = this.getAttribute('data-count');
      
      // Show tooltip
      let tooltip = document.querySelector('.chart-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        document.body.appendChild(tooltip);
      }
      
      tooltip.innerHTML = `
        <div><strong>Date:</strong> ${date}</div>
        <div><strong>Sessions:</strong> ${count}</div>
      `;
      
      // Position tooltip
      const rect = this.getBoundingClientRect();
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
      
      // Show tooltip
      tooltip.style.opacity = '1';
    });
    
    dayEl.addEventListener('mouseleave', function() {
      const tooltip = document.querySelector('.chart-tooltip');
      if (tooltip) {
        tooltip.style.opacity = '0';
      }
    });
    
    heatmapContainer.appendChild(dayEl);
  });
  
  // Add legend
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  legend.style.display = 'flex';
  legend.style.alignItems = 'center';
  legend.style.justifyContent = 'center';
  legend.style.marginTop = '10px';
  legend.style.gap = '5px';
  
  const legendText1 = document.createElement('span');
  legendText1.textContent = 'Less';
  legendText1.style.fontSize = '0.8rem';
  legendText1.style.color = 'var(--text-secondary)';
  legend.appendChild(legendText1);
  
  [0, 0.25, 0.5, 0.75, 1].forEach(intensity => {
    const box = document.createElement('div');
    box.style.width = '12px';
    box.style.height = '12px';
    box.style.backgroundColor = getHeatColor(intensity);
    box.style.borderRadius = '2px';
    legend.appendChild(box);
  });
  
  const legendText2 = document.createElement('span');
  legendText2.textContent = 'More';
  legendText2.style.fontSize = '0.8rem';
  legendText2.style.color = 'var(--text-secondary)';
  legend.appendChild(legendText2);
  
  container.appendChild(legend);
}

// Get color for heatmap based on intensity
function getHeatColor(intensity) {
  // Color gradient from light to dark blue
  if (intensity === 0) return 'var(--bg-primary)';
  
  // Use HSL to create a gradient from light to dark blue
  const h = 210; // blue hue
  const s = Math.min(100, 30 + intensity * 70); // saturation increases with intensity
  const l = Math.max(30, 80 - intensity * 50); // lightness decreases with intensity
  
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Render problem words list
function renderProblemWordsList(data) {
  const container = document.getElementById('problemWordsList');
  if (!container || !data) return;
  
  // Clear previous content
  container.innerHTML = '';
  
  // Get problem words
  let problemWords = [];
  
  if (selectedUser !== 'all' && data.userStats[selectedUser]) {
    // Get problem words for specific user
    problemWords = data.userStats[selectedUser].problemWords || [];
  } else {
    // Use the most missed words from summary
    problemWords = data.summary.mostMissedWords || [];
  }
  
  // If no data, show empty state
  if (problemWords.length === 0) {
    container.innerHTML = '<div class="empty-state">No problem words data available</div>';
    return;
  }
  
  // Create list items for each problem word
  problemWords.forEach(wordItem => {
    const item = document.createElement('div');
    item.className = 'problem-word-item';
    
    const word = document.createElement('div');
    word.className = 'problem-word';
    word.textContent = wordItem.word || wordItem.word;
    
    const count = document.createElement('div');
    count.className = 'problem-count';
    count.textContent = wordItem.missCount || wordItem.count || 0;
    
    item.appendChild(word);
    item.appendChild(count);
    container.appendChild(item);
  });
}

// Render user comparison chart
function renderUserComparisonChart(data) {
  const container = document.getElementById('userComparisonChart');
  if (!container || !data) return;
  
  // Clear previous content
  container.innerHTML = '';
  
  // Get user stats
  const userStats = data.userStats || {};
  
  // If no data or only one user selected, show message
  if (Object.keys(userStats).length === 0 || (selectedUser !== 'all' && Object.keys(userStats).length === 1)) {
    container.innerHTML = '<div class="empty-state">No comparison data available</div>';
    return;
  }
  
  // Create SVG
  const width = container.clientWidth || 500;
  const height = container.clientHeight || 200;
  const barPadding = 0.2;
  const chartPadding = { top: 20, right: 20, bottom: 60, left: 40 };
  const chartWidth = width - chartPadding.left - chartPadding.right;
  const chartHeight = height - chartPadding.top - chartPadding.bottom;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.overflow = 'visible';
  container.appendChild(svg);
  
  // Prepare data for chart
  const chartData = Object.keys(userStats).map(username => ({
    username,
    accuracy: userStats[username].accuracy || 0
  })).sort((a, b) => b.accuracy - a.accuracy);
  
  // Scale functions
  const xScale = index => (index / chartData.length) * chartWidth + chartPadding.left;
  const barWidth = chartWidth / chartData.length * (1 - barPadding);
  
  // Create bars
  chartData.forEach((user, i) => {
    const x = xScale(i);
    const barHeight = (user.accuracy / 100) * chartHeight;
    const y = chartHeight - barHeight + chartPadding.top;
    
    // Bar
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('fill', 'var(--primary)');
    rect.setAttribute('rx', '3');
    
    // Add hover effects and tooltip data
    rect.setAttribute('data-username', user.username);
    rect.setAttribute('data-accuracy', `${user.accuracy.toFixed(1)}%`);
    rect.addEventListener('mouseenter', showBarTooltip);
    rect.addEventListener('mouseleave', hideTooltip);
    
    svg.appendChild(rect);
    
    // User label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + barWidth / 2);
    label.setAttribute('y', chartHeight + chartPadding.top + 15);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '10px');
    label.setAttribute('fill', 'var(--text-secondary)');
    label.textContent = user.username;
    svg.appendChild(label);
    
    // Rotate username if there are many users
    if (chartData.length > 5) {
      label.setAttribute('transform', `rotate(45, ${x + barWidth / 2}, ${chartHeight + chartPadding.top + 15})`);
      label.setAttribute('text-anchor', 'start');
    }
    
    // Accuracy label on top of bar
    const accuracyLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    accuracyLabel.setAttribute('x', x + barWidth / 2);
    accuracyLabel.setAttribute('y', y - 5);
    accuracyLabel.setAttribute('text-anchor', 'middle');
    accuracyLabel.setAttribute('font-size', '10px');
    accuracyLabel.setAttribute('fill', 'var(--text-primary)');
    accuracyLabel.textContent = `${user.accuracy.toFixed(0)}%`;
    svg.appendChild(accuracyLabel);
  });
}

// Show tooltip for bar charts
function showBarTooltip(event) {
  // Get tooltip element or create one if it doesn't exist
  let tooltip = document.querySelector('.chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
  }
  
  // Get data from the bar
  const username = this.getAttribute('data-username');
  const accuracy = this.getAttribute('data-accuracy');
  
  // Format the content
  tooltip.innerHTML = `
    <div><strong>User:</strong> ${username}</div>
    <div><strong>Accuracy:</strong> ${accuracy}</div>
  `;
  
  // Position the tooltip
  const rect = this.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
  
  // Show the tooltip
  tooltip.style.opacity = '1';
}

// Render student breakdown table
function renderStudentBreakdownTable(data) {
  const tableBody = document.getElementById('studentBreakdown');
  if (!tableBody || !data) return;
  
  // Clear previous content
  tableBody.innerHTML = '';
  
  // Get user stats
  const userStats = data.userStats || {};
  
  // If no data, show empty state
  if (Object.keys(userStats).length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'No student data available';
    cell.style.textAlign = 'center';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }
  
  // Create a row for each user
  Object.keys(userStats).forEach(username => {
    const user = userStats[username];
    
    const row = document.createElement('tr');
    
    // Username cell
    const nameCell = document.createElement('td');
    nameCell.textContent = username;
    row.appendChild(nameCell);
    
    // Sessions cell
    const sessionsCell = document.createElement('td');
    sessionsCell.textContent = user.totalSessions || 0;
    row.appendChild(sessionsCell);
    
    // Words cell
    const wordsCell = document.createElement('td');
    wordsCell.textContent = user.totalWords || 0;
    row.appendChild(wordsCell);
    
    // Accuracy cell
    const accuracyCell = document.createElement('td');
    const accuracy = user.accuracy || 0;
    accuracyCell.textContent = `${accuracy.toFixed(1)}%`;
    row.appendChild(accuracyCell);
    
    // Trend sparkline cell
    const trendCell = document.createElement('td');
    const sparklineContainer = document.createElement('div');
    sparklineContainer.className = 'sparkline';
    trendCell.appendChild(sparklineContainer);
    row.appendChild(trendCell);
    
    tableBody.appendChild(row);
    
    // Create mini sparkline chart
    createSparkline(sparklineContainer, user.trend || []);
  });
}

// Create mini sparkline chart
function createSparkline(container, trendData) {
  if (!container || !trendData || trendData.length === 0) {
    container.innerHTML = '-';
    return;
  }
  
  // Create SVG
  const width = container.clientWidth || 80;
  const height = container.clientHeight || 24;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  container.appendChild(svg);
  
  // Scale functions
  const xScale = index => (index / (trendData.length - 1)) * width;
  const yScale = accuracy => height - (accuracy / 100) * height;
  
  // Create path for the line with validation to prevent NaN values
  const validPoints = trendData.filter((point) => {
    // Ensure we have valid accuracy data
    return point && typeof point.accuracy === 'number' && !isNaN(point.accuracy);
  });
  
  if (validPoints.length > 0) {
    // Create path only with valid data points
    const pathData = validPoints.map((point, i) => {
      // Ensure values are finite numbers
      const x = xScale(i);
      const y = yScale(Math.max(0, Math.min(100, point.accuracy || 0)));
      
      // Verify coordinates are valid numbers
      if (isNaN(x) || isNaN(y)) {
        console.warn('Invalid coordinate:', { x, y, point });
        return '';
      }
      
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).filter(segment => segment !== '').join(' ');
    
    // Only add the path if we have valid path data
    if (pathData && !pathData.includes('NaN')) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', 'var(--accent)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    } else {
      console.warn('Unable to create valid path data:', pathData);
    }
  } else {
    console.warn('No valid data points for trend chart');
  }
}

// Render recent activity feed
function renderRecentActivityFeed(data) {
  const container = document.getElementById('recentActivityList');
  if (!container || !data) return;
  
  // Clear previous content
  container.innerHTML = '';
  
  // Collect recent results from all users
  const allRecentResults = [];
  
  Object.keys(data.userStats || {}).forEach(username => {
    const user = data.userStats[username];
    (user.recentResults || []).forEach(result => {
      allRecentResults.push({
        username,
        date: new Date(result.date),
        score: result.score,
        total: result.total
      });
    });
  });
  
  // Sort by date (newest first)
  allRecentResults.sort((a, b) => b.date - a.date);
  
  // Limit to 10 most recent
  const recentResults = allRecentResults.slice(0, 10);
  
  // If no data, show empty state
  if (recentResults.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent activity data available</div>';
    return;
  }
  
  // Create activity items
  recentResults.forEach(activity => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    const info = document.createElement('div');
    info.innerHTML = `
      <span class="activity-user">${activity.username}</span>
      completed a session with score 
      <strong>${activity.score}/${activity.total}</strong>
    `;
    
    const time = document.createElement('div');
    time.className = 'activity-time';
    time.textContent = formatTimeAgo(activity.date);
    
    item.appendChild(info);
    item.appendChild(time);
    container.appendChild(item);
  });
}

// Format time ago (e.g., "2 hours ago")
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  
  if (diffHours > 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  
  if (diffMins > 0) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  }
  
  return 'just now';
}

// Export functions to window object
window.analyticsRefresh = analyticsRefresh;
window.populateUserDropdown = populateUserDropdown;
