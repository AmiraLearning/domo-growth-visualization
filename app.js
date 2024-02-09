const apiBaseUrl = '/data/v1/growth';
const groupby = ['usageCategory', 'week'];


const USAGE_CATEGORIES = ['Expected', 'Actual', 'High', 'Low'];
const USAGE_CATEGORY_COLORS = {
  'Expected': '#04BF8A',
  'Actual': '#2176ff',
  'High': '#04BF8A',
  'Low': '#2176ff',
}

domo.get(`${apiBaseUrl}?useBeastMode=true&groupby=${groupby.join()}`).then(handleResponse);

function handleResponse(growthData) {
  //TODO: handle no data and errors

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


  let plotData = [];
  const plotLayout = {
    title: 'Overall Growth CSM View',
    xaxis: {
      // title: `Average of ${overallAverageWeeksBetweenAssessment} weeks between assessments`,
      fixedrange: true,
      showgrid: false,
      tickvals: [0, 0.5, 1],
      ticktext: [
        'BOY Assessment',
        `Average of ${getOverallAverageWeeksBetweenAssessment(growthByUsageCategoryMap)} weeks between assessments`,
        'MOY Assessment'
        //TODO: Add EOY Assessment
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
  };

  growthByUsageCategoryMap.forEach((usageCategoryData, usageCategory) => {
    // only plot visible usage categories
    if(!usageCategoryData.isUsageCategoryVisible) return;

    const { usageCategoryDisplayName, usageCategoryColor, studentCount } = usageCategoryData;

    // add markers
    usageCategoryData.growthData.forEach((data, index) => {
      plotData.push({
        x: [index],
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

    let xCoordinates = usageCategoryData.growthData.map((data, index) => index);
    let yCoordinates = usageCategoryData.growthData.map(data => data.avgWeekGrowth);

    // add trace
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

    // add annotation for last data point
    plotLayout.annotations.push({
      text: `${Math.round(yCoordinates[yCoordinates.length - 1] * 10) / 10} weeks`,
      font: { size:13 },
      xref: 'paper',
      x: 0.955,
      y: yCoordinates[yCoordinates.length - 1],
      xanchor: 'left',
      yanchor: 'middle',
      showarrow: false
    });

    // add trace of hidden markers for student count hover
    let yStart = yCoordinates[0];
    let yEnd = yCoordinates[1];
    let xStart = xCoordinates[0];
    let xEnd = xCoordinates[1];
    let steps = 100; // Define the number of steps for interpolation

    for(let i = 0; i <= steps; i++) {
      xCoordinates.push(xStart + (xEnd - xStart) * (i / steps));
      yCoordinates.push(yStart + (yEnd - yStart) * (i / steps));
    }

    plotData.push({
      name: usageCategoryDisplayName,
      x: xCoordinates,
      y: yCoordinates,
      mode: 'markers',
      marker: {color: 'rgba(0,0,0,0.0)'},
      hovertemplate: `${studentCount.toLocaleString()} students <extra></extra>`,
      hoverlabel: {bgcolor: 'deep', font: { size: 16} },
      showlegend: false,
    });
  });

  const plotConfig = {
    displayModeBar: false,
  }

  Plotly.newPlot('chart-container', plotData, plotLayout, plotConfig);
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
