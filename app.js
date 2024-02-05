const apiBaseUrl = '/data/v1/growth';
const groupby = ['usageCategoryMinWeeksThreshold', 'week'];

const USAGE_CATEGORIES = ['Expected', 'Actual', 'High', 'Low'];
const USAGE_CATEGORY_COLORS = {
  'Expected': '#02733E',
  'Actual': '#04BF8A',
  'High': '#2176ff',
  'Low': '#01baef',
}


domo.get(`${apiBaseUrl}?useBeastMode=true&groupby=${groupby.join()}`).then(handleResponse);

function handleResponse(growthData) {
  let plotData = [];
  let weeksGrowthByUsageCategory = {};

  USAGE_CATEGORIES.forEach(usageCategory => {
    const usageCategoryData = growthData
      .filter(data => data.usageCategoryMinWeeksThreshold === usageCategory)
      .sort((a, b) => a.avgWeekGrowth - b.avgWeekGrowth);
    weeksGrowthByUsageCategory[usageCategory] = usageCategoryData[usageCategoryData.length - 1].avgWeekGrowth;

    const studentCount = usageCategoryData.length > 0 ? usageCategoryData[0].studentCount : null;

    let  x = usageCategoryData.map((data, index) => index);
    let y = usageCategoryData.map(data => data.avgWeekGrowth);


    let yStart = y[0];
    let yEnd = y[1];
    let xStart = 0;
    let xEnd = 1;
    let steps = 100; // Define the number of steps for interpolation

    for(let i = 0; i <= steps; i++) {
      x.push(xStart + (xEnd - xStart) * (i / steps));
      y.push(yStart + (yEnd - yStart) * (i / steps));
    }

    // add trace
    let trace = {
      name: usageCategory,
      x: x,
      y: y,
      mode: 'lines',
      line: {color: USAGE_CATEGORY_COLORS[usageCategory]},
      hoverinfo: 'skip',
    };
    plotData.push(trace);


    let pairwise = arr => arr.map((value, index) => [value, arr[index + 1]]).slice(0, arr.length - 1);
    let x_pairs = pairwise(x);
    let y_pairs = pairwise(y);

    // create mid points
    let x_mid = x_pairs.map(mid => mid.reduce((a, b) => a + b, 0) / 2);
    let y_mid = y_pairs.map(mid => mid.reduce((a, b) => a + b, 0) / 2);

    // add trace of hidden midpoints for hover information
    let midpoints = {
      name: usageCategory,
      x: x_mid,
      y: y_mid,
      mode: 'markers',
      marker: {color: 'rgba(0,0,0,0.0)'},
      hovertemplate: studentCount && `${studentCount} students <extra></extra>`,
      hoverlabel: {bgcolor: 'deep', font: { size: 16} },
      showlegend: false,
    };
    plotData.push(midpoints);
});

  // Sum up all the avgWeeksBetweenAssessment values
  const totalWeeksBetweenAssessments = growthData
    .map(data => data.avgWeeksBetweenAssessment)
    .reduce((a, b) => a + b, 0);

  // Calculate the average weeks between assessments
  let overallAverageWeeksBetweenAssessment = totalWeeksBetweenAssessments / growthData.length;

  // Round the average to the nearest one decimal place
  overallAverageWeeksBetweenAssessment = Math.round(overallAverageWeeksBetweenAssessment * 10) / 10;

  var plotLayout = {
    title: 'Overall Growth CSM View',
    xaxis: {
      // title: `Average of ${overallAverageWeeksBetweenAssessment} weeks between assessments`,
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
      xref: 'paper',
      x: 0.955,
      y: weeksGrowthByUsageCategory[usageCategory],
      xanchor: 'left',
      yanchor: 'middle',
      text: `${Math.round(weeksGrowthByUsageCategory[usageCategory] * 10) / 10} weeks`,
      showarrow: false
    };
    plotLayout.annotations.push(result);
  });

  Plotly.newPlot('chart-container', plotData, plotLayout, {displayModeBar: false});
}
