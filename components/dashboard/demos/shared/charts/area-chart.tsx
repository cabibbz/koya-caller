"use client"

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface DataPoint {
  name: string
  value: number
  [key: string]: string | number
}

interface AreaChartProps {
  data: DataPoint[]
  dataKey?: string
  color?: string
  gradientId?: string
  height?: number
  showGrid?: boolean
  showAxis?: boolean
  strokeWidth?: number
}

export function AreaChart({
  data,
  dataKey = "value",
  color = "#3B82F6",
  gradientId = "colorValue",
  height = 200,
  showGrid = true,
  showAxis = true,
  strokeWidth = 2,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={100} minHeight={height}>
      <RechartsAreaChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
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
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={strokeWidth}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}

interface MultiAreaChartProps {
  data: DataPoint[]
  areas: {
    dataKey: string
    color: string
    name?: string
  }[]
  height?: number
  showGrid?: boolean
  showAxis?: boolean
}

export function MultiAreaChart({
  data,
  areas,
  height = 200,
  showGrid = true,
  showAxis = true,
}: MultiAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <defs>
          {areas.map((area, i) => (
            <linearGradient
              key={i}
              id={`gradient-${area.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={area.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={area.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
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
        />
        {areas.map((area, i) => (
          <Area
            key={i}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name || area.dataKey}
            stroke={area.color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#gradient-${area.dataKey})`}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  )
}
