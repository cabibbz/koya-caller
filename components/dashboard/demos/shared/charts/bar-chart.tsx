"use client"

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface DataPoint {
  name: string
  value: number
  [key: string]: string | number
}

interface BarChartProps {
  data: DataPoint[]
  dataKey?: string
  color?: string
  height?: number
  showGrid?: boolean
  showAxis?: boolean
  highlightLast?: boolean
  radius?: number
  barSize?: number
}

export function BarChart({
  data,
  dataKey = "value",
  color = "#3B82F6",
  height = 200,
  showGrid = true,
  showAxis = true,
  highlightLast = true,
  radius = 4,
  barSize = 32,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={100} minHeight={height}>
      <RechartsBarChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
        )}
        {showAxis && (
          <>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(24, 24, 27, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.7)" }}
          itemStyle={{ color: color }}
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
        />
        <Bar
          dataKey={dataKey}
          radius={[radius, radius, 0, 0]}
          barSize={barSize}
          animationDuration={1500}
          animationEasing="ease-out"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                highlightLast && index === data.length - 1
                  ? color
                  : `${color}66`
              }
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

interface GroupedBarChartProps {
  data: DataPoint[]
  bars: {
    dataKey: string
    color: string
    name?: string
  }[]
  height?: number
  showGrid?: boolean
  showAxis?: boolean
  barSize?: number
}

export function GroupedBarChart({
  data,
  bars,
  height = 200,
  showGrid = true,
  showAxis = true,
  barSize = 20,
}: GroupedBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.1)"
            vertical={false}
          />
        )}
        {showAxis && (
          <>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(24, 24, 27, 0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.7)" }}
          cursor={{ fill: "rgba(255,255,255,0.05)" }}
        />
        {bars.map((bar, i) => (
          <Bar
            key={i}
            dataKey={bar.dataKey}
            name={bar.name || bar.dataKey}
            fill={bar.color}
            radius={[4, 4, 0, 0]}
            barSize={barSize}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
