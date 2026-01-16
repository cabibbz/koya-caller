"use client";

/**
 * Site Settings Client Component
 * Edit landing page stats and pricing
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  DollarSign,
  Save,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";

interface Setting {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string;
}

interface StatsValue {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

interface PricingValue {
  name: string;
  price: number;
  period: string;
  description: string;
  minutes: number;
  features: string[];
  highlighted: boolean;
  badge?: string;
  cta: string;
}

export function SiteSettingsClient() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.settings) {
        setSettings(data.settings);
        if (data.settings.length === 0) {
          setError("No settings found in database. Make sure the migration was run.");
        }
      }
    } catch (_err) {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: StatsValue | PricingValue) => {
    try {
      setSaving(key);
      setError(null);
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Update local state
      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value } : s))
      );

      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (_err) {
      setError("Failed to save setting");
    } finally {
      setSaving(null);
    }
  };

  const statsSettings = settings.filter((s) => s.category === "stats");
  const pricingSettings = settings.filter((s) => s.category === "pricing");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-muted-foreground">
            Configure landing page statistics and pricing
          </p>
        </div>
        <Button variant="outline" onClick={fetchSettings}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Landing Stats
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Pricing Plans
          </TabsTrigger>
        </TabsList>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Landing Page Statistics</CardTitle>
              <CardDescription>
                These numbers are displayed on the landing page to show social proof
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {statsSettings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No stats settings found. Check browser console for details.
                </p>
              ) : (
                statsSettings.map((setting) => {
                  const val = setting.value as StatsValue;
                  return (
                    <StatEditor
                      key={setting.key}
                      setting={setting}
                      value={val}
                      saving={saving === setting.key}
                      saved={saved === setting.key}
                      onSave={(newVal) => updateSetting(setting.key, newVal)}
                    />
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="space-y-4">
          {pricingSettings.map((setting) => {
            const val = setting.value as PricingValue;
            return (
              <PricingEditor
                key={setting.key}
                setting={setting}
                value={val}
                saving={saving === setting.key}
                saved={saved === setting.key}
                onSave={(newVal) => updateSetting(setting.key, newVal)}
              />
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Stats Editor Component
function StatEditor({
  setting,
  value,
  saving,
  saved,
  onSave,
}: {
  setting: Setting;
  value: StatsValue;
  saving: boolean;
  saved: boolean;
  onSave: (val: StatsValue) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  const handleSave = () => {
    onSave(localValue);
  };

  const hasChanges = JSON.stringify(localValue) !== JSON.stringify(value);

  return (
    <div className="grid gap-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{value.label}</h4>
          <p className="text-sm text-muted-foreground">{setting.description}</p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              Save
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2">
          <Label>Value</Label>
          <Input
            type="number"
            value={localValue.value}
            onChange={(e) =>
              setLocalValue({ ...localValue, value: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <Label>Prefix</Label>
          <Input
            value={localValue.prefix || ""}
            onChange={(e) =>
              setLocalValue({ ...localValue, prefix: e.target.value })
            }
            placeholder="e.g. $"
          />
        </div>
        <div>
          <Label>Suffix</Label>
          <Input
            value={localValue.suffix || ""}
            onChange={(e) =>
              setLocalValue({ ...localValue, suffix: e.target.value })
            }
            placeholder="e.g. +"
          />
        </div>
      </div>

      <div>
        <Label>Label</Label>
        <Input
          value={localValue.label}
          onChange={(e) =>
            setLocalValue({ ...localValue, label: e.target.value })
          }
        />
      </div>
    </div>
  );
}

// Pricing Editor Component
function PricingEditor({
  setting,
  value,
  saving,
  saved,
  onSave,
}: {
  setting: Setting;
  value: PricingValue;
  saving: boolean;
  saved: boolean;
  onSave: (val: PricingValue) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [featuresText, setFeaturesText] = useState(value.features.join("\n"));

  const handleSave = () => {
    const features = featuresText.split("\n").filter((f) => f.trim());
    onSave({ ...localValue, features });
  };

  const hasChanges =
    JSON.stringify({ ...localValue, features: featuresText.split("\n").filter((f) => f.trim()) }) !==
    JSON.stringify(value);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {value.name}
              {value.highlighted && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  Highlighted
                </span>
              )}
            </CardTitle>
            <CardDescription>{setting.description}</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>Plan Name</Label>
            <Input
              value={localValue.name}
              onChange={(e) =>
                setLocalValue({ ...localValue, name: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Price ($)</Label>
            <Input
              type="number"
              value={localValue.price}
              onChange={(e) =>
                setLocalValue({ ...localValue, price: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Minutes</Label>
            <Input
              type="number"
              value={localValue.minutes}
              onChange={(e) =>
                setLocalValue({ ...localValue, minutes: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Badge</Label>
            <Input
              value={localValue.badge || ""}
              onChange={(e) =>
                setLocalValue({ ...localValue, badge: e.target.value })
              }
              placeholder="e.g. Most Popular"
            />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Input
            value={localValue.description}
            onChange={(e) =>
              setLocalValue({ ...localValue, description: e.target.value })
            }
          />
        </div>

        <div>
          <Label>CTA Button Text</Label>
          <Input
            value={localValue.cta}
            onChange={(e) =>
              setLocalValue({ ...localValue, cta: e.target.value })
            }
          />
        </div>

        <div>
          <Label>Features (one per line)</Label>
          <Textarea
            rows={6}
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            placeholder="Enter each feature on a new line"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={localValue.highlighted}
            onCheckedChange={(checked) =>
              setLocalValue({ ...localValue, highlighted: checked })
            }
          />
          <Label>Highlight this plan (show as recommended)</Label>
        </div>
      </CardContent>
    </Card>
  );
}
