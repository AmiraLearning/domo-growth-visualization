const apiBaseUrl = '/data/v1/growth';
const groupby = ['usageCategory', 'week'];

const USAGE_CATEGORIES = [/*'Expected', 'Actual',*/ 'High', 'Low'];
const USAGE_CATEGORY_COLORS = {
  // 'Expected': '#02733E',
  // 'Actual': '#04BF8A',
  'High': '#04BF8A',
  'Low': '#2176ff',
}


domo.get(`${apiBaseUrl}?useBeastMode=true&groupby=${groupby.join()}`).then(handleResponse);

function handleResponse(growthData) {
  let plotData = [];
  let weeksGrowthByUsageCategory = {};

  USAGE_CATEGORIES.forEach(usageCategory => {
    const usageCategoryData = growthData
      .filter(data => data.usageCategory === usageCategory)
      .sort((a, b) => a.avgWeekGrowth - b.avgWeekGrowth);
    weeksGrowthByUsageCategory[usageCategory] = usageCategoryData[usageCategoryData.length - 1].avgWeekGrowth;

    const {
      usageCategoryDisplayName,
      studentCount
    } = usageCategoryData[0];

    // add markers
    usageCategoryData.forEach((data, index) => {
      plotData.push({
        x: [index],
        y: [data.avgWeekGrowth],
        mode: 'markers',
        marker: {
          color: USAGE_CATEGORY_COLORS[usageCategory],
          size: 9,
        },
        hoverinfo: 'skip',
        showlegend: false,
      });
    });

    let xCoordinates = usageCategoryData.map((data, index) => index);
    let yCoordinates = usageCategoryData.map(data => data.avgWeekGrowth);

     // add trace
    plotData.push({
      name: usageCategoryDisplayName,
      x: xCoordinates,
      y: yCoordinates,
      mode: 'lines',
      hoverinfo: 'skip',
      line: {
        color: USAGE_CATEGORY_COLORS[usageCategory],
        width: 4,
      },
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

  // Sum up all the avgWeeksBetweenAssessment values
  const totalWeeksBetweenAssessments = growthData
    .map(data => data.avgWeeksBetweenAssessment)
    .reduce((a, b) => a + b, 0);

  // Calculate the average weeks between assessments
  let overallAverageWeeksBetweenAssessment = totalWeeksBetweenAssessments / growthData.length;

  // Round the average to the nearest one decimal place
  overallAverageWeeksBetweenAssessment = Math.round(overallAverageWeeksBetweenAssessment * 10) / 10;

  const plotLayout = {
    title: 'Overall Growth CSM View',
    xaxis: {
      // title: `Average of ${overallAverageWeeksBetweenAssessment} weeks between assessments`,
      fixedrange: true,
      showgrid: false,
      tickvals: [0, 0.5, 1],
      ticktext: [
        'BOY Assessment',
        `Average of ${overallAverageWeeksBetweenAssessment} weeks between assessments`,
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

  USAGE_CATEGORIES.forEach((usageCategory) => {
    let result = {
      text: `${Math.round(weeksGrowthByUsageCategory[usageCategory] * 10) / 10} weeks`,
      font: { size:13 },
      xref: 'paper',
      x: 0.955,
      y: weeksGrowthByUsageCategory[usageCategory],
      xanchor: 'left',
      yanchor: 'middle',
      showarrow: false
    };
    plotLayout.annotations.push(result);
  });

  const plotConfig = {
    displayModeBar: false,
  }

  Plotly.newPlot('chart-container', plotData, plotLayout, plotConfig);
}
