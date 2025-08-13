// Charts and visualization for Spelling Practice App

// Function to create a simple score history line chart
function createScoreChart(username, results) {
    // Clear previous chart if it exists
    const chartContainer = document.getElementById('progressChart');
    chartContainer.innerHTML = '';
    
    if (!results || !Array.isArray(results) || results.length === 0) {
        chartContainer.innerHTML = '<p class="text-center">No data available for visualization</p>';
        return;
    }
    
    // Extract last 10 results (or fewer if not available)
    const recentResults = results.slice(-10);
    
    // Calculate dimensions
    const width = chartContainer.clientWidth || 500;
    const height = 250;
    const padding = { top: 20, right: 30, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.style.overflow = 'visible';
    chartContainer.appendChild(svg);
    
    // Get data points
    const dataPoints = recentResults.map((result, index) => {
        const score = result.score || 0;
        const total = (result.answers && result.answers.length) || 1;
        const percentage = (score / total) * 100;
        
        return {
            index,
            score: percentage,
            date: new Date(result.timestamp || Date.now()).toLocaleDateString()
        };
    });
    
    // Scale functions
    const xScale = index => (index / (dataPoints.length - 1 || 1)) * chartWidth + padding.left;
    const yScale = score => chartHeight - (score / 100) * chartHeight + padding.top;
    
    // Create path for the line
    const pathData = dataPoints.map((point, i) => {
        return `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(point.score)}`;
    }).join(' ');
    
    // Create the path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', 'var(--primary)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
    
    // Add area under the curve with gradient
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const areaPathData = `${pathData} L ${xScale(dataPoints.length - 1)} ${chartHeight + padding.top} L ${xScale(0)} ${chartHeight + padding.top} Z`;
    areaPath.setAttribute('d', areaPathData);
    areaPath.setAttribute('fill', 'url(#gradient)');
    areaPath.setAttribute('opacity', '0.3');
    
    // Create gradient
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', 'var(--primary)');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', 'var(--accent)');
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.appendChild(gradient);
    svg.appendChild(defs);
    svg.appendChild(areaPath);
    
    // Add data points
    dataPoints.forEach((point, i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xScale(i));
        circle.setAttribute('cy', yScale(point.score));
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', 'var(--primary)');
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '2');
        
        // Add hover tooltip
        circle.setAttribute('data-date', point.date);
        circle.setAttribute('data-score', `${Math.round(point.score)}%`);
        circle.addEventListener('mouseover', showTooltip);
        circle.addEventListener('mouseout', hideTooltip);
        
        svg.appendChild(circle);
    });
    
    // Add axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', padding.left);
    xAxis.setAttribute('y1', chartHeight + padding.top);
    xAxis.setAttribute('x2', chartWidth + padding.left);
    xAxis.setAttribute('y2', chartHeight + padding.top);
    xAxis.setAttribute('stroke', 'var(--text-secondary)');
    xAxis.setAttribute('stroke-width', '1');
    svg.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padding.left);
    yAxis.setAttribute('y1', padding.top);
    yAxis.setAttribute('x2', padding.left);
    yAxis.setAttribute('y2', chartHeight + padding.top);
    yAxis.setAttribute('stroke', 'var(--text-secondary)');
    yAxis.setAttribute('stroke-width', '1');
    svg.appendChild(yAxis);
    
    // Add labels for x-axis (first, middle, last)
    if (dataPoints.length > 0) {
        [0, Math.floor((dataPoints.length - 1) / 2), dataPoints.length - 1].forEach(i => {
            if (i < dataPoints.length) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', xScale(i));
                text.setAttribute('y', chartHeight + padding.top + 20);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '12px');
                text.setAttribute('fill', 'var(--text-secondary)');
                text.textContent = dataPoints[i].date;
                svg.appendChild(text);
            }
        });
    }
    
    // Add labels for y-axis (0%, 50%, 100%)
    [0, 50, 100].forEach(value => {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', padding.left - 10);
        text.setAttribute('y', yScale(value) + 5);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('font-size', '12px');
        text.setAttribute('fill', 'var(--text-secondary)');
        text.textContent = `${value}%`;
        svg.appendChild(text);
        
        const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tickLine.setAttribute('x1', padding.left - 5);
        tickLine.setAttribute('y1', yScale(value));
        tickLine.setAttribute('x2', padding.left);
        tickLine.setAttribute('y2', yScale(value));
        tickLine.setAttribute('stroke', 'var(--text-secondary)');
        tickLine.setAttribute('stroke-width', '1');
        svg.appendChild(tickLine);
    });
    
    // Add chart title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', 15);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '14px');
    title.setAttribute('fill', 'var(--text-primary)');
    title.setAttribute('font-weight', 'bold');
    title.textContent = `Progress Over Time`;
    svg.appendChild(title);
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.padding = '8px';
    tooltip.style.background = 'var(--bg-primary)';
    tooltip.style.border = '1px solid var(--border)';
    tooltip.style.borderRadius = 'var(--radius)';
    tooltip.style.boxShadow = 'var(--shadow)';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    tooltip.style.zIndex = '1000';
    chartContainer.appendChild(tooltip);
    
    function showTooltip(event) {
        const circle = event.target;
        const date = circle.getAttribute('data-date');
        const score = circle.getAttribute('data-score');
        
        tooltip.textContent = `${date}: ${score}`;
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY - 40}px`;
        tooltip.style.opacity = '1';
        
        circle.setAttribute('r', '7'); // Enlarge circle on hover
    }
    
    function hideTooltip(event) {
        tooltip.style.opacity = '0';
        event.target.setAttribute('r', '5'); // Reset circle size
    }
}

// Create a word difficulty analysis chart
function createWordDifficultyChart(username, results) {
    const chartContainer = document.getElementById('wordDifficultyChart');
    chartContainer.innerHTML = '';
    
    if (!results || !Array.isArray(results) || results.length === 0) {
        chartContainer.innerHTML = '<p class="text-center">No data available for word analysis</p>';
        return;
    }
    
    // Collect all words and count correct/incorrect attempts
    const wordStats = {};
    
    results.forEach(result => {
        if (result.answers && Array.isArray(result.answers)) {
            result.answers.forEach(answer => {
                const word = answer.word;
                if (!word) return;
                
                if (!wordStats[word]) {
                    wordStats[word] = { correct: 0, incorrect: 0, total: 0 };
                }
                
                if (answer.correct) {
                    wordStats[word].correct++;
                } else {
                    wordStats[word].incorrect++;
                }
                wordStats[word].total++;
            });
        }
    });
    
    // Convert to array and sort by difficulty (highest incorrect percentage first)
    const sortedWords = Object.entries(wordStats)
        .map(([word, stats]) => ({
            word,
            correctRate: (stats.correct / stats.total) * 100,
            total: stats.total
        }))
        .filter(item => item.total >= 2) // Only include words attempted at least twice
        .sort((a, b) => a.correctRate - b.correctRate) // Sort by difficulty
        .slice(0, 10); // Get top 10 most difficult words
    
    if (sortedWords.length === 0) {
        chartContainer.innerHTML = '<p class="text-center">Not enough data for word analysis yet</p>';
        return;
    }
    
    // Create horizontal bar chart
    const width = chartContainer.clientWidth || 500;
    const barHeight = 25;
    const height = sortedWords.length * (barHeight + 15) + 50;
    const padding = { top: 20, right: 30, bottom: 20, left: 150 };
    const chartWidth = width - padding.left - padding.right;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    chartContainer.appendChild(svg);
    
    // Scale function
    const xScale = value => (value / 100) * chartWidth;
    
    // Add bars
    sortedWords.forEach((item, i) => {
        const y = padding.top + i * (barHeight + 15);
        
        // Bar background (full width)
        const backgroundBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        backgroundBar.setAttribute('x', padding.left);
        backgroundBar.setAttribute('y', y);
        backgroundBar.setAttribute('width', chartWidth);
        backgroundBar.setAttribute('height', barHeight);
        backgroundBar.setAttribute('fill', 'var(--bg-secondary)');
        backgroundBar.setAttribute('rx', '4');
        svg.appendChild(backgroundBar);
        
        // Bar for correct percentage
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', padding.left);
        bar.setAttribute('y', y);
        bar.setAttribute('width', xScale(item.correctRate));
        bar.setAttribute('height', barHeight);
        bar.setAttribute('fill', getColorByRate(item.correctRate));
        bar.setAttribute('rx', '4');
        svg.appendChild(bar);
        
        // Word label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', padding.left - 10);
        label.setAttribute('y', y + barHeight/2 + 5);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('font-size', '14px');
        label.setAttribute('fill', 'var(--text-primary)');
        label.textContent = item.word;
        svg.appendChild(label);
        
        // Percentage label
        const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        percentText.setAttribute('x', padding.left + xScale(item.correctRate) + 5);
        percentText.setAttribute('y', y + barHeight/2 + 5);
        percentText.setAttribute('font-size', '14px');
        percentText.setAttribute('fill', 'var(--text-primary)');
        percentText.textContent = `${Math.round(item.correctRate)}%`;
        svg.appendChild(percentText);
    });
    
    // Add title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', 15);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '14px');
    title.setAttribute('fill', 'var(--text-primary)');
    title.setAttribute('font-weight', 'bold');
    title.textContent = `Word Success Rates`;
    svg.appendChild(title);
    
    // Function to get color based on rate
    function getColorByRate(rate) {
        if (rate < 40) return 'var(--error)';
        if (rate < 70) return 'var(--warning)';
        return 'var(--success)';
    }
}

// Export functions
window.createScoreChart = createScoreChart;
window.createWordDifficultyChart = createWordDifficultyChart;
