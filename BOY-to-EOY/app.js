const USAGE_CATEGORIES = ['Expected', 'Actual', 'High', 'Low'];
const USAGE_CAGTEGORY_DISPLAY_NAMES = {
  'Expected': 'Expected Growth',
  'Actual': 'Overall Growth',
  'High': 'High Use in both windows',
  'Mid': 'High Use in one window',
  'Low': 'Low Use in both windows',
}
const USAGE_CATEGORY_COLORS = {
  'Expected': '#09a6f3',
  'Actual': '#04BF8A',
  'High': '#04BF8A',
  'Mid': '#bf212f',
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

getGrowthData().then(handleResponse)

function getGrowthData() {
  const apiBaseUrl = '/data/v1/growthsummary';
  const filters = ['district_partition=1']
  const groupby = ['usageCategory', 'week'];
  return domo.get(`${apiBaseUrl}?useBeastMode=true&filter=${filters.join()}&groupby=${groupby.join()}`);
}

function handleResponse(growthData) {
  if(!growthData)
    return displayDataNotAvailableMessage();

    // order by growth data by avgWeeksGrowth in descending order so highest growth category is on top
    growthData = growthData.sort((a, b) => b.avgWeeksGrowth - a.avgWeeksGrowth);

  // map growth data to usage category
  const growthByUsageCategoryMap = growthData.reduce((map, data) => {
    const { usageCategory, week, avgWeeksGrowth, showActualEOYGrowth } = data;
    if (!map.has(usageCategory)) {
      const {
        usageCategory,
        isUsageCategoryVisible,
        studentCount,
        avgWeeksBetweenAssessmentsBOYtoMOY,
        avgWeeksBetweenAssessmentsMOYtoEOY,
        showActualEOYGrowth,
      } = data;

      map.set(usageCategory, {
        usageCategory,
        usageCategoryDisplayName: USAGE_CAGTEGORY_DISPLAY_NAMES[usageCategory],
        isUsageCategoryVisible,
        studentCount,
        avgWeeksBetweenAssessmentsBOYtoMOY,
        avgWeeksBetweenAssessmentsMOYtoEOY,
        usageCategoryColor: USAGE_CATEGORY_COLORS[usageCategory],
        showActualEOYGrowth,
        growthData: []
      });
    }

    // add growth data to usage category and sort by avgWeeksGrowth for display order
    let categoryGrowthData = map.get(usageCategory).growthData;

    // don't add to array when week === 'EOY Assessment' and !showActualEOYGrowth
    if (!(week === 'EOY Assessment' && !showActualEOYGrowth)) {
      categoryGrowthData.push({ week, avgWeeksGrowth });
    }

    // sort growth data for display order
    const order = ["BOY Assessment", "MOY Assessment", "EOY Assessment"];
    categoryGrowthData = categoryGrowthData.sort((a, b) => {
      return order.indexOf(a.week) - order.indexOf(b.week);
    });
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

  document.getElementById('app-container').innerHTML = '<div id="chart-container"></div>';
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

    // add current growth markers
    usageCategoryData.growthData.forEach((data, index) => {
      let xCoordinate = index * 50;
      let yCoordinate = data.avgWeeksGrowth;
      plotData.push({
        x: [xCoordinate],
        y: [yCoordinate],
        mode: 'markers',
        marker: {
          color: usageCategoryColor,
          size: 10,
        },
        hoverinfo: 'skip',
        showlegend: false,
      });

      if (data.week !== 'BOY Assessment' && usageCategoryData.usageCategory !== 'Mid') {
        // add annotations for current data points
        let windowDisplayName;
        if(data.week === 'MOY Assessment') windowDisplayName = 'MOY';
        if(data.week === 'EOY Assessment') windowDisplayName = 'EOY';

        plotLayout.annotations.push({
          x: xCoordinate,
          y: yCoordinate,
          xref: 'x',
          yref: 'y',
          align: 'center',
          text: `${usageCategoryIndex === 0 ? 'Weeks of growth:<br>' : ''}${Math.round(data.avgWeeksGrowth * 10) / 10} weeks<br>at ${windowDisplayName}`,
          font: {
            size: 12,
            color: usageCategoryColor,
          },
          showarrow: true,
          ax: 0,
          ay: usageCategoryIndex === 0 ? -60 : 50,
          arrowside: 'start',
          startarrowhead: 4,
          arrowwidth: 1.5,
          arrowcolor: usageCategoryColor,
        });
      }
    })

    // add trace for current growth data
    let xCoordinates = usageCategoryData.growthData.map((data, index) => index * 50);
    let yCoordinates = usageCategoryData.growthData.map(data => data.avgWeeksGrowth);
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

    // when actual EOY growth isn't displayed, show projected EOY growth
    let projectedXCoordinates = [50, 100];
    let projectedYCoordinates = [yCoordinates[yCoordinates.length - 1], (yCoordinates[yCoordinates.length - 1] * 2)];
    if (!usageCategoryData.showActualEOYGrowth) {
      // add projected growth markers and trace
      let projectedXCoordinates = [50, 100];
      let projectedYCoordinates = [yCoordinates[yCoordinates.length - 1], (yCoordinates[yCoordinates.length - 1] * 2)];
      growthProjections.push({ usageCategoryDisplayName, projectedWeeksGrowth: projectedYCoordinates[projectedYCoordinates.length - 1] });

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
        opacity: 0.6,
        line: {
          color: usageCategoryColor,
          width: 4,
          dash: 'dash',
        },
      });

      // add annotation for projected data points
      plotLayout.annotations.push({
        x: projectedXCoordinates[projectedXCoordinates.length - 1],
        y: projectedYCoordinates[projectedYCoordinates.length - 1],
        xref: 'x',
        yref: 'y',
        align: 'center',
        text: `${Math.round(projectedYCoordinates[projectedYCoordinates.length - 1] * 10) / 10} weeks<br>at EOY`,
        font: {
          size: 12,
          color: usageCategoryColor,
        },
        showarrow: true,
        ax: 0,
        ay: usageCategoryIndex === 0 ? -45 : 50,
        arrowside: 'start',
        startarrowhead: 4,
        arrowwidth: 1.5,
        arrowcolor: usageCategoryColor,
      });
    }

    // display average weeks between assessments on x-axis
    let { averageBOYtoMOY, averageMOYtoEOY } = getOverallAverageWeeksBetweenAssessments(growthByUsageCategoryMap);
    plotLayout.xaxis.title = `Average weeks between assessments:<br>BOY to MOY: ${averageBOYtoMOY}<br>MOY to EOY: ${averageMOYtoEOY}`;

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
  const moyHighestWeeksGrowth = visibleUsageCategories[0].growthData.find(_ => _.week === 'MOY Assessment').avgWeeksGrowth;
  const moyLowestWeeksGrowth = visibleUsageCategories[visibleUsageCategories.length - 1].growthData.find(_ => _.week === 'MOY Assessment').avgWeeksGrowth;
  const moyAverageGrowth = Math.round((moyHighestWeeksGrowth + moyLowestWeeksGrowth) / 2 * 10) / 10;

  let moyDeltaLine = {
    type: 'line',
    x0: 50,
    y0: moyHighestWeeksGrowth - 0.9,
    x1: 50,
    y1: moyLowestWeeksGrowth + 0.75,
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
      size: 12,
      color: '#4f4f4f',
    },
    align: 'left',
    showarrow: true,
    ax: -100,
    ay: 0,
    arrowside: 'start',
    startarrowhead: 4,
    arrowwidth: 1.5,
    arrowcolor: '#4f4f4f',
  });

  const showActualEOYGrowth = visibleUsageCategories.some(category => category.showActualEOYGrowth);
  if (showActualEOYGrowth) {
    const eoyHighestWeeksGrowth = visibleUsageCategories[0].growthData.find(_ => _.week === 'EOY Assessment').avgWeeksGrowth;
    const eoyLowestWeeksGrowth = visibleUsageCategories[visibleUsageCategories.length - 1].growthData.find(_ => _.week === 'EOY Assessment').avgWeeksGrowth;
    const eoyAverageGrowth = Math.round((eoyHighestWeeksGrowth + eoyLowestWeeksGrowth) / 2 * 10) / 10;

    let eoyDeltaLine = {
      type: 'line',
      x0: 100,
      y0: eoyHighestWeeksGrowth - 0.9,
      x1: 100,
      y1: eoyLowestWeeksGrowth + 0.75,
      line: {
        color: '#4f4f4f',
        width: 2,
        dash: 'dot'
      }
    }
    plotLayout.shapes.push(eoyDeltaLine);

    // add annotation for EOY growth delta
    plotLayout.annotations.push({
      x: 100,
      y: eoyAverageGrowth,
      xref: 'x',
      yref: 'y',
      text: `${getPercentGrowthIncrease(eoyLowestWeeksGrowth, eoyHighestWeeksGrowth)}% more<br>reading growth<br>at end of year<br>(observed)`,
      font: {
        size: 12,
        color: '#4f4f4f',
      },
      align: 'left',
      showarrow: true,
      ax: 80,
      ay: 0,
      arrowside: 'start',
      startarrowhead: 4,
      arrowwidth: 1.5,
      arrowcolor: '#4f4f4f',
    });
  }
  else {
    const projectedHighestWeeksGrowth = weeksGrowthProjections[0].projectedWeeksGrowth;
    const projectedLowestWeeksGrowth = weeksGrowthProjections[1].projectedWeeksGrowth;
    const projectedAverageGrowth = Math.round((projectedHighestWeeksGrowth + projectedLowestWeeksGrowth) / 2 * 10) / 10;
    const projectedWeeksGrowthDelta = Math.round((projectedHighestWeeksGrowth - projectedLowestWeeksGrowth) * 10) / 10;

    let projectedDeltaLine = {
      type: 'line',
      x0: 100,
      y0: projectedHighestWeeksGrowth - 0.9,
      x1: 100,
      y1: projectedLowestWeeksGrowth + 0.75,
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
        size: 12,
        color: '#4f4f4f',
      },
      align: 'left',
      showarrow: true,
      ax: 75,
      ay: 0,
      arrowside: 'start',
      startarrowhead: 4,
      arrowwidth: 1.5,
      arrowcolor: '#4f4f4f',
    });
  }
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

function getOverallAverageWeeksBetweenAssessments(growthByUsageCategoryMap) {
  // Flatten the arrays in the map into a single array
  let allData = [...growthByUsageCategoryMap.values()].flat();

  // Filter the data where isUsageCategoryVisible equals 1
  let visibleData = allData.filter(data => data.isUsageCategoryVisible === 1);

  // Calculate the sum of all avgWeeksBetweenAssessment for the filtered data
  let sumBOYtoMOY = visibleData.reduce((total, data) => total + data.avgWeeksBetweenAssessmentsBOYtoMOY, 0);
  let sumMOYtoEOY = visibleData.reduce((total, data) => total + data.avgWeeksBetweenAssessmentsMOYtoEOY, 0);

  // Calculate the average
  let averageBOYtoMOY = sumBOYtoMOY / visibleData.length;
  let averageMOYtoEOY = sumMOYtoEOY / visibleData.length;

  // round to 1 decimal place
  averageBOYtoMOY = Math.round(averageBOYtoMOY * 10) / 10;
  averageMOYtoEOY = Math.round(averageMOYtoEOY * 10) / 10;

  return {
    averageBOYtoMOY,
    averageMOYtoEOY,
  };
}

function getPercentGrowthIncrease(lowestWeeksGrowth, highestWeeksGrowth) {
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
  document.getElementById('app-container').innerHTML = `
    <div id="message-container">
      District data is not available for school admins.
      <p>Please see the Overall Growth - School Level chart for your school's growth data</p>
    </div>
  `;
}
