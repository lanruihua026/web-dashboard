import * as echarts from 'echarts'

/** 将 #RRGGBB 转为 rgba（供 ECharts 渐变使用） */
export function rgbaFromHex(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 仓位配置（与全局设计系统一致） */
export const BINS_CHART = [
  { key: 'phone', name: '手机仓', color: '#1e40af' },
  { key: 'mouse', name: '数码配件仓', color: '#3b82f6' },
  { key: 'battery', name: '电池仓', color: '#d97706' }
]

/**
 * 根据当前主题返回图表配色方案
 * @param {import('vue').Ref<boolean>} isDarkMode
 * @returns {import('vue').ComputedRef<object>}
 */
export function useChartTheme(isDarkMode) {
  return computed(() => {
    if (isDarkMode.value) {
      return {
        tooltipBg: 'rgba(17,27,47,0.95)',
        tooltipBorder: 'rgba(255,255,255,0.16)',
        tooltipText: '#e5ecf6',
        secondaryText: '#b6c2d3',
        mutedText: '#8da0b8',
        axisLine: 'rgba(255,255,255,0.14)',
        splitLine: 'rgba(255,255,255,0.08)'
      }
    }
    return {
      tooltipBg: 'rgba(255,255,255,0.95)',
      tooltipBorder: 'rgba(31,42,55,0.14)',
      tooltipText: '#1f2a37',
      secondaryText: '#4b5563',
      mutedText: '#7b8794',
      axisLine: 'rgba(31,42,55,0.16)',
      splitLine: 'rgba(31,42,55,0.08)'
    }
  })
}

/**
 * 构建趋势折线图配置
 */
export function buildTrendOption(data, palette, bins = BINS_CHART) {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: palette.axisLine } },
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: 13 },
      formatter(params) {
        const time = new Date(params[0].axisValue).toLocaleTimeString('zh-CN')
        let html = `<div style="margin-bottom:6px;color:${palette.mutedText};font-size:12px">${time}</div>`
        params.forEach((p) => {
          html += `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
            <span style="color:${palette.secondaryText}">${p.seriesName}</span>
            <span style="font-weight:600;margin-left:auto;color:${palette.tooltipText}">${p.value[1]} g</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      top: 8,
      right: 16,
      textStyle: { color: palette.mutedText, fontSize: 13 },
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10
    },
    grid: { top: 52, right: 24, bottom: 48, left: 60 },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisLabel: {
        color: palette.mutedText,
        fontSize: 12,
        formatter(val) {
          return new Date(val).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '重量 (g)',
      nameTextStyle: { color: palette.mutedText, fontSize: 12 },
      min: 0,
      max: 1100,
      axisLine: { show: false },
      axisLabel: { color: palette.mutedText, fontSize: 12 },
      splitLine: { lineStyle: { color: palette.splitLine } },
      markLine: {
        silent: true,
        data: [{ yAxis: 1000, name: '满仓线' }],
        lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 },
        label: { formatter: '满仓 1000g', color: '#ef4444', fontSize: 11, position: 'end' }
      }
    },
    series: bins.map((bin) => ({
      name: bin.name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: data.map((p) => [p.time, p[bin.key]]),
      lineStyle: { color: bin.color, width: 2.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: rgbaFromHex(bin.color, 0.35) },
          { offset: 1, color: rgbaFromHex(bin.color, 0.02) }
        ])
      },
      emphasis: { focus: 'series' }
    }))
  }
}

/**
 * 构建当前对比柱状图配置
 */
export function buildBarOption(data, palette, bins = BINS_CHART) {
  if (!data.length) return {}
  const latest = data[data.length - 1]

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: 13 },
      formatter(params) {
        const p = params[0]
        const pct = ((p.value / 1000) * 100).toFixed(1)
        return `<div style="display:flex;align-items:center;gap:8px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
          <span style="color:${palette.secondaryText}">${p.name}</span>
          <span style="font-weight:600;color:${palette.tooltipText}">${p.value} g (${pct}%)</span>
        </div>`
      }
    },
    grid: { top: 24, right: 32, bottom: 36, left: 60 },
    xAxis: {
      type: 'category',
      data: bins.map((b) => b.name),
      axisLine: { lineStyle: { color: palette.axisLine } },
      axisLabel: { color: palette.secondaryText, fontSize: 13 },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '重量 (g)',
      nameTextStyle: { color: palette.mutedText, fontSize: 12 },
      min: 0,
      max: 1100,
      axisLine: { show: false },
      axisLabel: { color: palette.mutedText, fontSize: 12 },
      splitLine: { lineStyle: { color: palette.splitLine } }
    },
    series: [
      {
        type: 'bar',
        data: bins.map((bin) => ({
          name: bin.name,
          value: latest[bin.key] ?? 0,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: bin.color },
              { offset: 1, color: rgbaFromHex(bin.color, 0.45) }
            ]),
            borderRadius: [6, 6, 0, 0]
          }
        })),
        barWidth: '40%',
        label: {
          show: true,
          position: 'top',
          color: palette.secondaryText,
          fontSize: 12,
          formatter(p) {
            return `${p.value} g\n${((p.value / 1000) * 100).toFixed(1)}%`
          }
        },
        markLine: {
          silent: true,
          data: [{ yAxis: 1000 }],
          lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 },
          label: { formatter: '满仓', color: '#ef4444', fontSize: 11 }
        }
      }
    ]
  }
}
