"use client";

/**
 * Blog Management Client - Enhanced
 * Features: Editor, Scheduling, Image Generation, SEO Scoring, Analytics
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  FileText,
  Clock,
  Eye,
  Trash2,
  Edit,
  Send,
  Loader2,
  Check,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Calendar,
  BarChart3,
  TrendingUp,
  Target,
  AlertCircle,
  X,
  Save,
  ArrowLeft,
} from "lucide-react";
import { calculateSEOScore, getScoreColor, getScoreBgColor, getScoreLabel, type SEOScore } from "@/lib/seo-scoring";
import ReactMarkdown from "react-markdown";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  target_keyword: string | null;
  lsi_keywords: string[] | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  published_at: string | null;
  scheduled_for: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  config: {
    tone: string;
    length: string;
    seo_focus: string;
    content_type: string;
    include_images: boolean;
  };
  is_default: boolean;
}

interface BlogManagementClientProps {
  initialPosts: BlogPost[];
  presets: Preset[];
}

// Configuration options
const TONE_OPTIONS = [
  { id: "professional", label: "Professional", emoji: "👔" },
  { id: "casual", label: "Casual", emoji: "😊" },
  { id: "authoritative", label: "Authoritative", emoji: "🎓" },
  { id: "helpful", label: "Helpful", emoji: "🤝" },
  { id: "witty", label: "Witty", emoji: "😄" },
  { id: "technical", label: "Technical", emoji: "⚙️" },
];

const LENGTH_OPTIONS = [
  { id: "short", label: "Quick Read", words: "~500 words", emoji: "📝" },
  { id: "medium", label: "Standard", words: "~1000 words", emoji: "📄" },
  { id: "long", label: "In-Depth", words: "~2000 words", emoji: "📚" },
];

const SEO_FOCUS_OPTIONS = [
  { id: "high", label: "High Volume", desc: "Target popular keywords", emoji: "🔥" },
  { id: "medium", label: "Balanced", desc: "Mix of volume & competition", emoji: "⚖️" },
  { id: "low", label: "Low Competition", desc: "Easier to rank", emoji: "🎯" },
];

const CONTENT_TYPE_OPTIONS = [
  { id: "article", label: "Article", emoji: "📰" },
  { id: "tutorial", label: "How-To Guide", emoji: "📋" },
  { id: "listicle", label: "List Post", emoji: "📊" },
  { id: "news", label: "News Update", emoji: "🗞️" },
  { id: "insight", label: "Industry Insight", emoji: "💡" },
];

const IMAGE_STYLE_OPTIONS = [
  { id: "modern", label: "Modern", desc: "Clean gradients & shapes" },
  { id: "minimalist", label: "Minimalist", desc: "Simple & clean" },
  { id: "illustration", label: "Illustration", desc: "Flat vector style" },
  { id: "photo", label: "Photo", desc: "Stock photo style" },
];

type ViewMode = "list" | "generator" | "editor" | "analytics";
type GenerationStep = "topic" | "tone" | "length" | "seo" | "type" | "review" | "generating" | "complete";

export function BlogManagementClient({ initialPosts, presets }: BlogManagementClientProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentStep, setCurrentStep] = useState<GenerationStep>("topic");
  const [_isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<BlogPost | null>(null);

  // Generation config
  const [topic, setTopic] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [selectedLength, setSelectedLength] = useState("medium");
  const [selectedSeoFocus, setSelectedSeoFocus] = useState("medium");
  const [selectedContentType, setSelectedContentType] = useState("article");
  const [generateImage, setGenerateImage] = useState(true);
  const [imageStyle, setImageStyle] = useState("modern");

  // Editor state
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [editorTab, setEditorTab] = useState<"edit" | "preview" | "seo">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // Analytics
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "all">("30d");

  // Calculate SEO score for editor
  const seoScore = useMemo<SEOScore | null>(() => {
    if (!editingPost) return null;
    return calculateSEOScore({
      title: editingPost.title,
      metaTitle: editingPost.meta_title || undefined,
      metaDescription: editingPost.meta_description || undefined,
      content: editingPost.content,
      targetKeyword: editingPost.target_keyword || undefined,
    });
  }, [editingPost]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const now = new Date();
    const cutoff = analyticsRange === "7d"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : analyticsRange === "30d"
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : new Date(0);

    const filteredPosts = posts.filter(p => {
      if (p.status !== "published" || !p.published_at) return false;
      return new Date(p.published_at) >= cutoff;
    });

    const totalViews = filteredPosts.reduce((sum, p) => sum + p.view_count, 0);
    const avgViews = filteredPosts.length > 0 ? Math.round(totalViews / filteredPosts.length) : 0;
    const topPosts = [...posts]
      .filter(p => p.status === "published")
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 5);

    return {
      totalPosts: posts.length,
      publishedPosts: posts.filter(p => p.status === "published").length,
      scheduledPosts: posts.filter(p => p.status === "scheduled").length,
      draftPosts: posts.filter(p => p.status === "draft").length,
      totalViews: posts.reduce((sum, p) => sum + p.view_count, 0),
      periodViews: totalViews,
      avgViews,
      topPosts,
    };
  }, [posts, analyticsRange]);

  const resetGenerator = () => {
    setCurrentStep("topic");
    setTopic("");
    setTargetKeyword("");
    setSelectedTone("professional");
    setSelectedLength("medium");
    setSelectedSeoFocus("medium");
    setSelectedContentType("article");
    setGenerateImage(true);
    setImageStyle("modern");
    setGeneratedPost(null);
  };

  const handlePresetSelect = (preset: Preset) => {
    setSelectedTone(preset.config.tone);
    setSelectedLength(preset.config.length);
    setSelectedSeoFocus(preset.config.seo_focus);
    setSelectedContentType(preset.config.content_type);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCurrentStep("generating");

    try {
      const response = await fetch("/api/admin/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          targetKeyword,
          config: {
            tone: selectedTone,
            length: selectedLength,
            seo_focus: selectedSeoFocus,
            content_type: selectedContentType,
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.post) {
        // Fetch full post data
        const postResponse = await fetch(`/api/admin/blog/${data.post.id}`);
        const postData = await postResponse.json();

        if (postData.post) {
          setGeneratedPost(postData.post);

          // Generate image if enabled
          if (generateImage) {
            setIsGeneratingImage(true);
            try {
              await fetch("/api/admin/blog/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  postId: postData.post.id,
                  title: postData.post.title,
                  topic,
                  style: imageStyle,
                }),
              });
              // Refresh post to get image URL
              const refreshResponse = await fetch(`/api/admin/blog/${postData.post.id}`);
              const refreshData = await refreshResponse.json();
              if (refreshData.post) {
                setGeneratedPost(refreshData.post);
              }
            } catch (_imgError) {
              // Error handled silently
            } finally {
              setIsGeneratingImage(false);
            }
          }
        }

        setCurrentStep("complete");
        // Refresh posts list
        const postsResponse = await fetch("/api/admin/blog");
        const postsData = await postsResponse.json();
        if (postsData.posts) {
          setPosts(postsData.posts);
        }
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (_error) {
      setCurrentStep("review");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePost = async () => {
    if (!editingPost) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/blog/${editingPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingPost.title,
          content: editingPost.content,
          excerpt: editingPost.excerpt,
          meta_title: editingPost.meta_title,
          meta_description: editingPost.meta_description,
          target_keyword: editingPost.target_keyword,
          category: editingPost.category,
        }),
      });

      if (response.ok) {
        setPosts(posts.map(p => p.id === editingPost.id ? editingPost : p));
      }
    } catch (_error) {
      // Error handled silently
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (postId: string) => {
    try {
      await fetch(`/api/admin/blog/${postId}/publish`, { method: "POST" });
      setPosts(posts.map(p =>
        p.id === postId ? { ...p, status: "published" as const, published_at: new Date().toISOString() } : p
      ));
    } catch (_error) {
      // Error handled silently
    }
  };

  const handleSchedule = async (postId: string) => {
    if (!scheduleDate || !scheduleTime) return;

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

    try {
      await fetch(`/api/admin/blog/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          scheduled_for: scheduledFor,
        }),
      });

      setPosts(posts.map(p =>
        p.id === postId ? { ...p, status: "scheduled" as const, scheduled_for: scheduledFor } : p
      ));
      setScheduleEnabled(false);
      setScheduleDate("");
      setScheduleTime("");
    } catch (_error) {
      // Error handled silently
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await fetch(`/api/admin/blog/${postId}`, { method: "DELETE" });
      setPosts(posts.filter(p => p.id !== postId));
      if (editingPost?.id === postId) {
        setEditingPost(null);
        setViewMode("list");
      }
    } catch (_error) {
      // Error handled silently
    }
  };

  const handleGenerateImage = async () => {
    if (!editingPost) return;
    setIsGeneratingImage(true);

    try {
      const response = await fetch("/api/admin/blog/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: editingPost.id,
          title: editingPost.title,
          style: imageStyle,
        }),
      });

      const data = await response.json();
      if (data.success && data.imageUrl) {
        const updatedPost = {
          ...editingPost,
          featured_image_url: data.imageUrl,
          featured_image_alt: editingPost.title,
        };
        setEditingPost(updatedPost);
        setPosts(posts.map(p => p.id === editingPost.id ? updatedPost : p));
      }
    } catch (_error) {
      // Error handled silently
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const openEditor = async (postId: string) => {
    try {
      const response = await fetch(`/api/admin/blog/${postId}`);
      const data = await response.json();
      if (data.post) {
        setEditingPost(data.post);
        setViewMode("editor");
      }
    } catch (_error) {
      // Error handled silently
    }
  };

  // Render bubble step for generator
  const renderBubbleStep = () => {
    switch (currentStep) {
      case "topic":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">What should we write about?</h3>
              <p className="text-muted-foreground">Enter a topic or keyword to generate an SEO-optimized article</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Topic or Title Idea</Label>
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., How AI is transforming small business phone systems..."
                  rows={3}
                  className="text-lg"
                />
              </div>

              <div>
                <Label className="mb-2 block">Target Keyword (optional)</Label>
                <Input
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  placeholder="e.g., AI phone answering service"
                />
              </div>

              {/* Image Generation Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Generate Featured Image</p>
                    <p className="text-sm text-muted-foreground">AI will create a custom image</p>
                  </div>
                </div>
                <Switch checked={generateImage} onCheckedChange={setGenerateImage} />
              </div>

              {generateImage && (
                <div className="grid grid-cols-2 gap-2">
                  {IMAGE_STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setImageStyle(style.id)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        imageStyle === style.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{style.label}</p>
                      <p className="text-xs text-muted-foreground">{style.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">Or start with a preset:</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <motion.button
                    key={preset.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePresetSelect(preset)}
                    className="px-4 py-2 rounded-full border bg-card hover:border-primary hover:bg-primary/5 transition-colors text-sm"
                  >
                    {preset.name}
                  </motion.button>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={!topic.trim()}
              onClick={() => setCurrentStep("tone")}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        );

      case "tone":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Pick the tone</h3>
              <p className="text-muted-foreground">How should this article sound?</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TONE_OPTIONS.map((option) => (
                <BubbleOption
                  key={option.id}
                  selected={selectedTone === option.id}
                  onClick={() => {
                    setSelectedTone(option.id);
                    setTimeout(() => setCurrentStep("length"), 300);
                  }}
                  emoji={option.emoji}
                  label={option.label}
                />
              ))}
            </div>
          </motion.div>
        );

      case "length":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">How long?</h3>
              <p className="text-muted-foreground">Choose the article length</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {LENGTH_OPTIONS.map((option) => (
                <BubbleOption
                  key={option.id}
                  selected={selectedLength === option.id}
                  onClick={() => {
                    setSelectedLength(option.id);
                    setTimeout(() => setCurrentStep("seo"), 300);
                  }}
                  emoji={option.emoji}
                  label={option.label}
                  sublabel={option.words}
                />
              ))}
            </div>
          </motion.div>
        );

      case "seo":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">SEO Strategy</h3>
              <p className="text-muted-foreground">What&apos;s your ranking goal?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SEO_FOCUS_OPTIONS.map((option) => (
                <BubbleOption
                  key={option.id}
                  selected={selectedSeoFocus === option.id}
                  onClick={() => {
                    setSelectedSeoFocus(option.id);
                    setTimeout(() => setCurrentStep("type"), 300);
                  }}
                  emoji={option.emoji}
                  label={option.label}
                  sublabel={option.desc}
                />
              ))}
            </div>
          </motion.div>
        );

      case "type":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Content Type</h3>
              <p className="text-muted-foreground">What format works best?</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <BubbleOption
                  key={option.id}
                  selected={selectedContentType === option.id}
                  onClick={() => {
                    setSelectedContentType(option.id);
                    setTimeout(() => setCurrentStep("review"), 300);
                  }}
                  emoji={option.emoji}
                  label={option.label}
                />
              ))}
            </div>
          </motion.div>
        );

      case "review":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Ready to generate?</h3>
              <p className="text-muted-foreground">Review your settings</p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Topic:</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{topic}</span>
                </div>
                {targetKeyword && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Keyword:</span>
                    <span className="font-medium">{targetKeyword}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tone:</span>
                  <Badge variant="secondary">{TONE_OPTIONS.find(t => t.id === selectedTone)?.label}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Length:</span>
                  <Badge variant="secondary">{LENGTH_OPTIONS.find(l => l.id === selectedLength)?.label}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SEO Focus:</span>
                  <Badge variant="secondary">{SEO_FOCUS_OPTIONS.find(s => s.id === selectedSeoFocus)?.label}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="secondary">{CONTENT_TYPE_OPTIONS.find(c => c.id === selectedContentType)?.label}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Featured Image:</span>
                  <Badge variant={generateImage ? "default" : "outline"}>
                    {generateImage ? `${IMAGE_STYLE_OPTIONS.find(s => s.id === imageStyle)?.label}` : "None"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep("topic")} className="flex-1">
                Edit Settings
              </Button>
              <Button onClick={handleGenerate} className="flex-1 gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Article
              </Button>
            </div>
          </motion.div>
        );

      case "generating":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-primary" />
            </motion.div>
            <h3 className="text-xl font-semibold mb-2">
              {isGeneratingImage ? "Generating image..." : "Generating your article..."}
            </h3>
            <p className="text-muted-foreground">
              {isGeneratingImage ? "Creating your featured image" : "This may take 30-60 seconds"}
            </p>

            <div className="mt-8 space-y-2 text-sm text-muted-foreground">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                Researching topic...
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
                Creating outline...
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 6 }}>
                Writing content...
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 10 }}>
                Optimizing for SEO...
              </motion.p>
              {generateImage && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 15 }}>
                  Generating featured image...
                </motion.p>
              )}
            </div>
          </motion.div>
        );

      case "complete":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Article Generated!</h3>
              <p className="text-muted-foreground">Your article is ready for review</p>
            </div>

            {generatedPost && (
              <Card>
                <CardContent className="p-4">
                  {generatedPost.featured_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={generatedPost.featured_image_url}
                      alt={generatedPost.featured_image_alt || generatedPost.title}
                      className="w-full h-40 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h4 className="font-semibold mb-2">{generatedPost.title}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{generatedPost.excerpt}</p>
                  <div className="flex gap-2">
                    <Badge>{generatedPost.status}</Badge>
                    {generatedPost.target_keyword && (
                      <Badge variant="outline">{generatedPost.target_keyword}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (generatedPost) {
                    openEditor(generatedPost.id);
                  }
                }}
                className="flex-1 gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Article
              </Button>
              <Button
                onClick={() => {
                  resetGenerator();
                  setViewMode("list");
                }}
                className="flex-1 gap-2"
              >
                <Check className="w-4 h-4" />
                Done
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  // Render editor view
  const renderEditor = () => {
    if (!editingPost) return null;

    return (
      <div className="space-y-6">
        {/* Editor Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => { setEditingPost(null); setViewMode("list"); }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Posts
          </Button>
          <div className="flex items-center gap-2">
            {/* SEO Score Badge */}
            {seoScore && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBgColor(seoScore.overall)} ${getScoreColor(seoScore.overall)}`}>
                SEO: {seoScore.overall}/100
              </div>
            )}
            <Button variant="outline" onClick={handleSavePost} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="ml-2">Save</span>
            </Button>
            {editingPost.status === "draft" && (
              <>
                <Button variant="outline" onClick={() => setScheduleEnabled(!scheduleEnabled)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
                <Button onClick={() => handlePublish(editingPost.id)}>
                  <Send className="w-4 h-4 mr-2" />
                  Publish
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Scheduling Panel */}
        {scheduleEnabled && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div>
                  <Label className="mb-1 block">Date</Label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label className="mb-1 block">Time</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
                <div className="flex-1" />
                <Button
                  onClick={() => handleSchedule(editingPost.id)}
                  disabled={!scheduleDate || !scheduleTime}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule Post
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setScheduleEnabled(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Editor Tabs */}
        <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as typeof editorTab)}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            {/* Title */}
            <div>
              <Label className="mb-2 block">Title</Label>
              <Input
                value={editingPost.title}
                onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                className="text-xl font-semibold"
              />
            </div>

            {/* Featured Image */}
            <div>
              <Label className="mb-2 block">Featured Image</Label>
              <div className="border rounded-lg p-4">
                {editingPost.featured_image_url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editingPost.featured_image_url}
                      alt={editingPost.featured_image_alt || editingPost.title}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute bottom-2 right-2"
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage}
                    >
                      {isGeneratingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <p className="mb-4">No featured image</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                      >
                        {IMAGE_STYLE_OPTIONS.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                      <Button onClick={handleGenerateImage} disabled={isGeneratingImage}>
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        Generate Image
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Excerpt */}
            <div>
              <Label className="mb-2 block">Excerpt</Label>
              <Textarea
                value={editingPost.excerpt || ""}
                onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                rows={2}
                placeholder="Brief summary for previews..."
              />
            </div>

            {/* Content */}
            <div>
              <Label className="mb-2 block">Content (Markdown)</Label>
              <Textarea
                value={editingPost.content}
                onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                rows={20}
                className="font-mono text-sm"
                placeholder="Write your content in Markdown..."
              />
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardContent className="p-6">
                {editingPost.featured_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editingPost.featured_image_url}
                    alt={editingPost.featured_image_alt || editingPost.title}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                <h1 className="text-3xl font-bold mb-4">{editingPost.title}</h1>
                {editingPost.excerpt && (
                  <p className="text-lg text-muted-foreground mb-6">{editingPost.excerpt}</p>
                )}
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <ReactMarkdown>{editingPost.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo" className="space-y-6">
            {/* SEO Score Overview */}
            {seoScore && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>SEO Score</span>
                    <span className={`text-3xl ${getScoreColor(seoScore.overall)}`}>
                      {seoScore.overall}/100
                    </span>
                  </CardTitle>
                  <CardDescription>{getScoreLabel(seoScore.overall)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Score Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: "Title", score: seoScore.breakdown.titleScore },
                      { label: "Meta Desc", score: seoScore.breakdown.metaDescriptionScore },
                      { label: "Keywords", score: seoScore.breakdown.keywordDensity },
                      { label: "Headings", score: seoScore.breakdown.headingsScore },
                      { label: "Readability", score: seoScore.breakdown.readabilityScore },
                      { label: "Length", score: seoScore.breakdown.contentLength },
                    ].map((item) => (
                      <div key={item.label} className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className={`text-2xl font-bold ${getScoreColor(item.score)}`}>
                          {Math.round(item.score)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Suggestions */}
                  {seoScore.suggestions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Suggestions</h4>
                      <ul className="space-y-2">
                        {seoScore.suggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Meta Fields */}
            <Card>
              <CardHeader>
                <CardTitle>Meta Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-2 block">Meta Title ({(editingPost.meta_title || "").length}/60)</Label>
                  <Input
                    value={editingPost.meta_title || ""}
                    onChange={(e) => setEditingPost({ ...editingPost, meta_title: e.target.value })}
                    placeholder="Title for search results"
                    maxLength={70}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Meta Description ({(editingPost.meta_description || "").length}/160)</Label>
                  <Textarea
                    value={editingPost.meta_description || ""}
                    onChange={(e) => setEditingPost({ ...editingPost, meta_description: e.target.value })}
                    placeholder="Description for search results"
                    rows={2}
                    maxLength={170}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Target Keyword</Label>
                  <Input
                    value={editingPost.target_keyword || ""}
                    onChange={(e) => setEditingPost({ ...editingPost, target_keyword: e.target.value })}
                    placeholder="Primary keyword to target"
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Category</Label>
                  <Input
                    value={editingPost.category || ""}
                    onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                    placeholder="e.g., AI, Business, Technology"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Render analytics view
  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Blog Analytics</h2>
          <p className="text-muted-foreground">Track your content performance</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "all"] as const).map((range) => (
            <Button
              key={range}
              variant={analyticsRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setAnalyticsRange(range)}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "All Time"}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalPosts}</p>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.publishedPosts}</p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.avgViews}</p>
                <p className="text-sm text-muted-foreground">Avg Views/Post</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Top Performing Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topPosts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No published posts yet</p>
          ) : (
            <div className="space-y-3">
              {analytics.topPosts.map((post, i) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => openEditor(post.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-muted-foreground w-8">#{i + 1}</span>
                    <div>
                      <p className="font-medium">{post.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {post.category || "Uncategorized"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{post.view_count.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => setViewMode("list")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Posts
      </Button>
    </div>
  );

  // Render posts list
  const renderPostsList = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{posts.length}</p>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{posts.filter(p => p.status === "published").length}</p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{posts.filter(p => p.status === "draft" || p.status === "scheduled").length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{posts.reduce((sum, p) => sum + p.view_count, 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posts List */}
      <Card>
        <CardHeader>
          <CardTitle>All Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">Generate your first AI-powered article</p>
              <Button onClick={() => setViewMode("generator")} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Create First Post
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1 min-w-0">
                      {post.featured_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.featured_image_url}
                          alt=""
                          className="w-20 h-14 object-cover rounded-lg shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{post.title}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            variant={
                              post.status === "published"
                                ? "default"
                                : post.status === "scheduled"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {post.status}
                          </Badge>
                          {post.status === "scheduled" && post.scheduled_for && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.scheduled_for).toLocaleString()}
                            </span>
                          )}
                          {post.target_keyword && (
                            <span className="text-xs text-muted-foreground">
                              {post.target_keyword}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {post.view_count}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEditor(post.id)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {post.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => handlePublish(post.id)}>
                          Publish
                        </Button>
                      )}
                      {post.status === "published" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/blog/${post.slug}`, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(post.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Blog Manager</h1>
              <p className="text-muted-foreground">AI-powered content generation for SEO</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "analytics" ? "default" : "outline"}
                onClick={() => setViewMode(viewMode === "analytics" ? "list" : "analytics")}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
              <Button
                onClick={() => {
                  resetGenerator();
                  setViewMode("generator");
                }}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                New Article
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {viewMode === "generator" ? (
            <motion.div
              key="generator"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI Article Generator
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
                    Cancel
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Progress indicator */}
                  <div className="flex items-center gap-2 mb-8">
                    {["topic", "tone", "length", "seo", "type", "review"].map((step, i) => (
                      <div key={step} className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${
                            ["topic", "tone", "length", "seo", "type", "review"].indexOf(currentStep) >= i
                              ? "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                        {i < 5 && (
                          <div
                            className={`w-8 h-0.5 ${
                              ["topic", "tone", "length", "seo", "type", "review"].indexOf(currentStep) > i
                                ? "bg-primary"
                                : "bg-muted"
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {renderBubbleStep()}
                </CardContent>
              </Card>
            </motion.div>
          ) : viewMode === "editor" ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderEditor()}
            </motion.div>
          ) : viewMode === "analytics" ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderAnalytics()}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderPostsList()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Bubble option component
function BubbleOption({
  selected,
  onClick,
  emoji,
  label,
  sublabel,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-4 rounded-xl border-2 transition-all text-left ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/50"
      }`}
    >
      <span className="text-2xl mb-2 block">{emoji}</span>
      <span className="font-medium block">{label}</span>
      {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
    </motion.button>
  );
}
