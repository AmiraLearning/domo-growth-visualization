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
    maxallowed: 112,
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
  if(!growthData)
    return displayDataNotAvailableMessage();

  // sort growth data by avgWeekGrowth for display order
  growthData = growthData.sort((a, b) => b.avgWeekGrowth - a.avgWeekGrowth);

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

  // check if any usage category is visible
  const isAnyUsageCategoryVisible = growthData.some(data => data.isUsageCategoryVisible === 1);
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
  let visibleUsageCategories = [];
  let growthProjections = [];

  growthByUsageCategoryMap.forEach((usageCategoryData) => {
    // only plot visible usage categories
    if(!usageCategoryData.isUsageCategoryVisible) return;

    visibleUsageCategories.push(usageCategoryData);

    const { usageCategoryDisplayName, usageCategoryColor, studentCount } = usageCategoryData;

    // add current growth markers and trace
    usageCategoryData.growthData.forEach((data, index) => {
      plotData.push({
        x: [index * 50],
        y: [data.avgWeekGrowth],
        mode: 'markers',
        marker: {
          color: usageCategoryColor,
          size: 10,
        },
        hoverinfo: 'skip',
        showlegend: false,
      });
    });

    let xCoordinates = usageCategoryData.growthData.map((data, index) => index * 50);
    let yCoordinates = usageCategoryData.growthData.map(data => data.avgWeekGrowth);

    // add annotation for last data point
    let arrowX = usageCategoryIndex === 0 ? -50 : 20;
    let arrowY = usageCategoryIndex === 0 ? -50 : 50;
    plotLayout.annotations.push({
      x: xCoordinates[xCoordinates.length - 1],
      y: yCoordinates[yCoordinates.length - 1],
      xref: 'x',
      yref: 'y',
      align: 'left',
      text: `${usageCategoryIndex === 0 ? 'Weeks of growth:<br>' : ''}${Math.round(yCoordinates[yCoordinates.length - 1] * 10) / 10} weeks<br>at MOY`,
      font: {
        size: 12,
        color: usageCategoryColor,
      },
      showarrow: true,
      ax: arrowX,
      ay: arrowY,
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
    growthProjections.push({usageCategoryDisplayName, projectedWeeksGrowth: projectedYCoordinates[projectedYCoordinates.length - 1]});

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
      align: 'left',
      text: `${Math.round(projectedYCoordinates[projectedYCoordinates.length - 1] * 10) / 10} weeks<br>at EOY`,
      font: {
        size: 11,
        color: usageCategoryColor,
      },
      showarrow: true,
      ax: 50,
      ay: usageCategoryIndex === 0 ? -25 : 25,
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

  if(visibleUsageCategories.length > 1)
    plotGrowthDeltaAnnotations(visibleUsageCategories, growthProjections);
}

function plotGrowthDeltaAnnotations(visibleUsageCategories, weeksGrowthProjections) {
    const moyHighestWeeksGrowth = visibleUsageCategories[0].growthData.find(_ => _.week === 'MOY Assessment').avgWeekGrowth;
    const moyLowestWeeksGrowth = visibleUsageCategories[1].growthData.find(_ => _.week === 'MOY Assessment').avgWeekGrowth;
    const moyAverageGrowth = Math.round((moyHighestWeeksGrowth + moyLowestWeeksGrowth) / 2 * 10) / 10;

    let moyDeltaLine = {
      type: 'line',
      x0: 50,
      y0: moyHighestWeeksGrowth,
      x1: 50,
      y1: moyLowestWeeksGrowth,
      line: {
        color: '#4f4f4f',
        width: 2,
        dash: 'dot'
      }
    }
    plotLayout.shapes.push(moyDeltaLine);

    // add annotation for MOY growth delta
    plotLayout.annotations.push({
      x: 50,
      y: moyAverageGrowth,
      xref: 'x',
      yref: 'y',
      text: `${getPercentGrowthIncrease(moyLowestWeeksGrowth, moyHighestWeeksGrowth)}% more reading<br>growth as of<br>middle of year<br>(observed)`,
      font: {
        size: 11,
        color: '#4f4f4f',
      },
      align: 'left',
      showarrow: true,
      ax: 140,
      ay: 35,
      arrowsize: 1.5,
      arrowwidth: 1,
      arrowcolor: '#4f4f4f',
    });

    const projectedHighestWeeksGrowth = weeksGrowthProjections[0].projectedWeeksGrowth;
    const projectedLowestWeeksGrowth = weeksGrowthProjections[1].projectedWeeksGrowth;
    const projectedAverageGrowth = Math.round((projectedHighestWeeksGrowth + projectedLowestWeeksGrowth) / 2 * 10) / 10;
    const projectedWeeksGrowthDelta = Math.round((projectedHighestWeeksGrowth - projectedLowestWeeksGrowth) * 10) / 10;

    let projectedDeltaLine = {
      type: 'line',
      x0: 100,
      y0: projectedHighestWeeksGrowth,
      x1: 100,
      y1: projectedLowestWeeksGrowth,
      line: {
        color: '#4f4f4f',
        width: 2,
        dash: 'dot'
      }
    }

    plotLayout.shapes.push(projectedDeltaLine);

    // add annotation for projected growth delta
    plotLayout.annotations.push({
      x: 100,
      y: projectedAverageGrowth,
      xref: 'x',
      yref: 'y',
      text: `${getApproximateMonthsFromWeeks(projectedWeeksGrowthDelta)} months of<br>reading growth<br>by end of year<br>(projected)`,
      font: {
        size: 11,
        color: '#4f4f4f',
      },
      align: 'left',
      showarrow: true,
      ax: 65,
      ay: 0,
      arrowsize: 1.5,
      arrowwidth: 1,
      arrowcolor: '#4f4f4f',
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

function getPercentGrowthIncrease(lowestWeeksGrowth, highestWeeksGrowth){
  // calculate percent growth increase
  const percentGrowth = ((highestWeeksGrowth - lowestWeeksGrowth) / lowestWeeksGrowth) * 100;

  //return percentage rounded to nearest whole number
  return Math.round(percentGrowth);
}

function getApproximateMonthsFromWeeks(weeks) {
  // approximate months
  let months = weeks / 4.33;
  // round to 1 decimal place
  months = Math.round(months * 10) / 10;

  // determine if the number is positive, negative, or zero
  let relativeToZeroSymbol;
  if (Math.sign(months > 0)) relativeToZeroSymbol = '+';
  else if (Math.sign(months < 0)) relativeToZeroSymbol = '-';
  else relativeToZeroSymbol = '';

  // return the formatted string
  return `${relativeToZeroSymbol}${months}`;
}

function displayDataNotAvailableMessage() {
  document.getElementById('message-container').innerHTML = `
    <div>
      District data is not available for school admins.
      <p>Please see the Overall Growth - School Level chart for your school's growth data</p>
    </div>
  `;
}
