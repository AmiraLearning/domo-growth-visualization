const apiBaseUrl = '/data/v1/growth';
const groupby = ['usageCategory', 'week'];

const USAGE_CATEGORIES = ['Expected', 'Actual', 'High', 'Low'];
const USAGE_CATEGORY_COLORS = {
  'Expected': '#04BF8A',
  'Actual': '#2176ff',
  'High': '#04BF8A',
  'Low': '#2176ff',
}

let plotData = [];
const plotLayout = {
  margin: { t: 10 },
  xaxis: {
    fixedrange: true,
    showgrid: false,
    minallowed: -3,
    maxallowed: 103,
    tickvals: [0, 50, 100],
    tickangle: 0,
    ticktext: [
      'BOY Assessment',
      'MOY Assessment',
      'EOY Assessment',
    ],
  },
  yaxis: {
    title: 'Weeks of Growth',
    fixedrange: true,
    minallowed: -1,
  },
  legend: {
    orientation: 'h',
    x: 0.5,
    xanchor: 'center',
    y: 1.1,
    yanchor: 'top',
  },
  annotations: [],
  shapes: [],
};

domo.get(`${apiBaseUrl}?useBeastMode=true&groupby=${groupby.join()}`).then(handleResponse);

function handleResponse(growthData) {
  // sort growth data by avgWeekGrowth for display order
  growthData = growthData.sort((a, b) => b.avgWeekGrowth - a.avgWeekGrowth);

  const isAnyUsageCategoryVisible = growthData.some(data => data.isUsageCategoryVisible === 1);

  // map growth data to usage category
  const growthByUsageCategoryMap = growthData.reduce((map, data) => {
    const {usageCategory, week, avgWeekGrowth} = data;
    if (!map.has(usageCategory)) {
      const {
        usageCategoryDisplayName,
        isUsageCategoryVisible,
        studentCount,
        avgWeeksBetweenAssessment,
      } = data;

      map.set(usageCategory, {
        usageCategoryDisplayName,
        isUsageCategoryVisible,
        studentCount,
        avgWeeksBetweenAssessment,
        usageCategoryColor: USAGE_CATEGORY_COLORS[usageCategory],
        growthData: []
      });
    }


    // add growth data to usage category and sort by avgWeekGrowth for display order
    let categoryGrowthData = map.get(usageCategory).growthData;
    categoryGrowthData.push({week, avgWeekGrowth});
    categoryGrowthData = categoryGrowthData.sort((a, b) => a.avgWeekGrowth - b.avgWeekGrowth);
    map.get(usageCategory).growthData = categoryGrowthData;

    return map;
  }, new Map());

  if(!isAnyUsageCategoryVisible) displayNoDataMessage();
  else plotVisibleUsageCategories(growthByUsageCategoryMap);

  const plotConfig = {
    displayModeBar: false,
    responsive: true,
  }

  Plotly.newPlot('chart-container', plotData, plotLayout, plotConfig);
}

function plotVisibleUsageCategories(growthByUsageCategoryMap) {
  let usageCategoryIndex = 0;
  growthByUsageCategoryMap.forEach((usageCategoryData) => {
    // only plot visible usage categories
    if(!usageCategoryData.isUsageCategoryVisible) return;

    const { usageCategoryDisplayName, usageCategoryColor, studentCount } = usageCategoryData;

    // add current growh markers and trace
    usageCategoryData.growthData.forEach((data, index) => {
      plotData.push({
        x: [index * 50],
        y: [data.avgWeekGrowth],
        mode: 'markers',
        marker: {
          color: usageCategoryColor,
          size: 9,
        },
        hoverinfo: 'skip',
        showlegend: false,
      });
    });

    let xCoordinates = usageCategoryData.growthData.map((data, index) => index * 50);
    let yCoordinates = usageCategoryData.growthData.map(data => data.avgWeekGrowth);

    // add annotation for last data point
    const xArrowShift = 50;
    const yArrowShift = 30;

    let arrowX = usageCategoryIndex === 0 ? -(xArrowShift) : xArrowShift;
    let arrowY = usageCategoryIndex === 0 ? -(yArrowShift) : yArrowShift;
    plotLayout.annotations.push({
      x: xCoordinates[xCoordinates.length - 1],
      y: yCoordinates[yCoordinates.length - 1],
      xref: 'x',
      yref: 'y',
      text: `${usageCategoryIndex === 0 ? 'Weeks of growth:<br>' : ''}${Math.round(yCoordinates[yCoordinates.length - 1] * 10) / 10} weeks at MOY`,
      font: {
        size: 11,
        color: usageCategoryColor,
      },
      showarrow: true,
      ax: arrowX,
      ay: arrowY,
      align: 'center',
      arrowhead: 2,
      arrowsize: .5,
      arrowwidth: 1.5,
      arrowcolor: usageCategoryColor,
    });

    plotData.push({
      name: usageCategoryDisplayName,
      x: xCoordinates,
      y: yCoordinates,
      mode: 'lines',
      hoverinfo: 'skip',
      line: {
        color: usageCategoryColor,
        width: 4,
      },
    });

    // add projected growth markers and trace
    let projectedXCoordinates = [50, 100];
    let projectedYCoordinates = [yCoordinates[yCoordinates.length - 1], (yCoordinates[yCoordinates.length - 1] * 2)];
    plotData.push({
      x: projectedXCoordinates,
      y: projectedYCoordinates,
      mode: 'markers',
      marker: {
        color: usageCategoryColor,
        size: 9,
      },
      hoverinfo: 'skip',
      showlegend: false,
    });

    plotData.push({
      name: usageCategoryDisplayName,
      x: projectedXCoordinates,
      y: projectedYCoordinates,
      mode: 'lines',
      hoverinfo: 'skip',
      showlegend: false,
      line: {
        color: usageCategoryColor,
        width: 4,
        dash: 'dashdot'
      },
    });

    // add annotation for projected data points
    plotLayout.annotations.push({
      x: projectedXCoordinates[projectedXCoordinates.length - 1],
      y: projectedYCoordinates[projectedYCoordinates.length - 1],
      xref: 'x',
      yref: 'y',
      text: `${Math.round(projectedYCoordinates[projectedYCoordinates.length - 1] * 10) / 10} weeks<br>at EOY`,
      font: {
        size: 11,
        color: usageCategoryColor,
      },
      showarrow: true,
      ax: 50,
      ay: 0,
      arrowhead: 2,
      arrowsize: .5,
      arrowwidth: 1.5,
      arrowcolor: usageCategoryColor,
    });

    // display average weeks between assessments on x-axis
    plotLayout.xaxis.title = `${getOverallAverageWeeksBetweenAssessment(growthByUsageCategoryMap)} average weeks between assessments`;

    // add trace of hidden markers for student count hover
    let hoverXCoordinates = [];
    let hoverYCoordinates = [];
    let yStart = yCoordinates[0];
    let yEnd = projectedYCoordinates[1];
    let xStart = xCoordinates[0];
    let xEnd = projectedXCoordinates[1];
    let steps = 100; // define the number of steps for interpolation

    for(let i = 0; i <= steps; i++) {
      hoverXCoordinates.push(xStart + (xEnd - xStart) * (i / steps));
      hoverYCoordinates.push(yStart + (yEnd - yStart) * (i / steps));
    }

    plotData.push({
      x: hoverXCoordinates,
      y: hoverYCoordinates,
      mode: 'markers',
      marker: {color: 'rgba(0,0,0,0.0)'},
      hovertemplate: `${studentCount.toLocaleString()} students <extra></extra>`,
      hoverlabel: {bgcolor: 'deep', font: { size: 16} },
      showlegend: false,
    });

    usageCategoryIndex++;
  });
}

function displayNoDataMessage() {
  plotLayout.yaxis.ticks = ''
  plotLayout.yaxis.showticklabels = false;

  plotData.push({
    x: [0, 1],
    y: [0, 20],
    mode: 'markers',
    marker: {color: 'rgba(0,0,0,0.0)'},
    showlegend: false,
  });

  plotLayout.annotations.push({
    text: 'No growth data available',
    font: { size: 16 },
    xref: 'paper',
    yref: 'paper',
    x: 0.5,
    y: 0.5,
    xanchor: 'center',
    yanchor: 'middle',
    showarrow: false,
  });
}

function getOverallAverageWeeksBetweenAssessment(growthByUsageCategoryMap) {
  // Flatten the arrays in the map into a single array
  let allData = [...growthByUsageCategoryMap.values()].flat();
  // Filter the data where isUsageCategoryVisible equals 1
  let visibleData = allData.filter(data => data.isUsageCategoryVisible === 1);
  // Calculate the sum of all avgWeeksBetweenAssessment for the filtered data
  let sum = visibleData.reduce((total, data) => total + data.avgWeeksBetweenAssessment, 0);
  // Calculate the average
  let average = sum / visibleData.length;
  // round to 1 decimal place
  average = Math.round(average * 10) / 10;

  return average;
}
