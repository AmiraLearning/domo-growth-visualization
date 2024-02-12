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
    tickvals: [0, 50, 100],
    ticktext: [
      'BOY Assessment',
      'MOY Assessment',
      'EOY Assessment',
    ],
  },
  yaxis: {
    title: 'Weeks of Growth',
    fixedrange: true,
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

    map.get(usageCategory).growthData.push({
      week,
      avgWeekGrowth,
    });

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
    let textAngle = findAngleBetween(xCoordinates[0], yCoordinates[0], xCoordinates[xCoordinates.length - 1], yCoordinates[yCoordinates.length - 1]);
    let annotationX = xCoordinates[xCoordinates.length - 1];
    let annotationY = usageCategoryIndex === 0 ? yCoordinates[yCoordinates.length - 1] - 2 : yCoordinates[yCoordinates.length - 1] + 3;
    plotLayout.annotations.push({
      name: usageCategoryDisplayName,
      text: `${Math.round(yCoordinates[yCoordinates.length - 1] * 10) / 10} weeks`,
      textangle: textAngle - 8,
      font: {
        size: 13,
        color: usageCategoryColor,
      },
      x: annotationX,
      y: annotationY,
      showarrow: false
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

function findAngleBetween(x1,  y1,  x2,  y2)
{
  // find angle in radians
  let   calc_angle = Math.atan2(y2 - y1,  x2 - x1);
  // make negative angles positive by adding 360 degrees
  if(calc_angle < 0) calc_angle += Math.PI * 2;

  // convert angle from radians to degrees then log
  // return calc_angle * (180 / Math.PI);
  return calc_angle * -100;
}
