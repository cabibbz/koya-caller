import { Check, X, DollarSign, UserX, Sparkles } from "lucide-react"

/**
 * Comparison Section
 * Spec Reference: Part 2, Lines 85-89
 * 
 * Requirements:
 * - Line 86: Human receptionist: $2,500-4,000/mo
 * - Line 87: Answering service: $200-500/mo + per call fees, no booking
 * - Line 88: Koya: Starting at $99/mo, 24/7, books appointments, never calls in sick
 */
export function ComparisonSection() {
  const comparisons = [
    {
      title: "Human Receptionist",
      // Spec Line 86
      price: "$2,500-4,000",
      period: "/month",
      icon: UserX,
      color: "border-error/30 bg-error/5",
      iconColor: "text-error",
      features: [
        { text: "Limited to business hours", positive: false },
        { text: "Vacation & sick days", positive: false },
        { text: "Training required", positive: false },
        { text: "One call at a time", positive: false },
        { text: "Books appointments", positive: true },
        { text: "Personal touch", positive: true },
      ],
      footer: "High cost, limited availability"
    },
    {
      title: "Answering Service",
      // Spec Line 87
      price: "$200-500",
      period: "/month + fees",
      icon: DollarSign,
      color: "border-warning/30 bg-warning/5",
      iconColor: "text-warning",
      features: [
        { text: "Per-call fees add up", positive: false },
        { text: "No appointment booking", positive: false },
        { text: "Script-based responses", positive: false },
        { text: "Transfer to voicemail", positive: false },
        { text: "24/7 availability", positive: true },
        { text: "Message taking", positive: true },
      ],
      footer: "Hidden fees, no booking"
    },
    {
      title: "Koya Caller",
      // Spec Line 88
      price: "$99",
      period: "/month",
      icon: Sparkles,
      color: "border-primary bg-gradient-to-br from-primary/10 to-accent/10",
      iconColor: "text-accent",
      highlighted: true,
      features: [
        { text: "24/7 availability", positive: true },
        { text: "Books appointments directly", positive: true },
        { text: "Never calls in sick", positive: true },
        { text: "Handles unlimited calls", positive: true },
        { text: "English + Spanish", positive: true },
        { text: "Knows your business", positive: true },
      ],
      footer: "Smart, affordable, always available"
    },
  ]

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-accent font-medium mb-4">Compare Options</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">Why Choose </span>
            <span className="brand-gradient-text">Koya?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how Koya stacks up against traditional phone answering options.
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {comparisons.map((option, index) => (
            <div
              key={index}
              className={`relative rounded-2xl border p-6 lg:p-8 transition-all duration-300 ${option.color} ${
                option.highlighted 
                  ? "md:scale-105 shadow-xl shadow-primary/10" 
                  : "hover:border-muted/50"
              }`}
            >
              {/* Recommended Badge */}
              {option.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-bold text-white">
                    RECOMMENDED
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-lg bg-card flex items-center justify-center ${option.iconColor}`}>
                  <option.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {option.title}
                </h3>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-3xl lg:text-4xl font-bold text-foreground">
                  {option.price}
                </span>
                <span className="text-muted-foreground">
                  {option.period}
                </span>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                {option.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {feature.positive ? (
                      <Check className="w-5 h-5 text-success flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-muted flex-shrink-0" />
                    )}
                    <span className={feature.positive ? "text-foreground" : "text-muted-foreground"}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-border/50">
                <p className={`text-sm ${option.highlighted ? "text-accent font-medium" : "text-muted-foreground"}`}>
                  {option.footer}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "96%", label: "Cost savings vs. human receptionist" },
            { value: "24/7", label: "Availability, every day of the year" },
            { value: "5 min", label: "Setup time from start to finish" },
            { value: "100%", label: "Calls answered, never a missed call" },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl md:text-3xl font-bold brand-gradient-text mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
