"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"

interface DonutDataPoint {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface DonutChartProps {
  data: DonutDataPoint[]
  size?: number
  innerRadius?: number
  outerRadius?: number
  showLabel?: boolean
  centerLabel?: string
  centerValue?: string | number
}

export function DonutChart({
  data,
  size = 200,
  innerRadius = 60,
  outerRadius = 80,
  showLabel: _showLabel = false,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(24, 24, 27, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            formatter={(value, name) => [
              `${value ?? 0} (${(((Number(value) || 0) / total) * 100).toFixed(1)}%)`,
              name ?? "",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-2xl font-bold text-white">{centerValue}</span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

interface DonutLegendProps {
  data: DonutDataPoint[]
  className?: string
}

export function DonutLegend({ data, className = "" }: DonutLegendProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className={`space-y-2 ${className}`}>
      {data.map((item, index) => (
        <div key={index} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-muted-foreground">{item.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{item.value}</span>
            <span className="text-xs text-muted-foreground">
              ({((item.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
