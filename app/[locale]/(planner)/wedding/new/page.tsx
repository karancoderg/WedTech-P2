"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Plus, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { FUNCTION_SUGGESTIONS } from "@/lib/constants";
import { toast } from "sonner";

interface FunctionForm {
  name: string;
  date: string;
  time: string;
  venueName: string;
  venueAddress: string;
}

export default function CreateWeddingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 fields
  const [weddingName, setWeddingName] = useState("");
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [templateId, setTemplateId] = useState<"floral" | "royal" | "minimal">("royal");

  // Step 2 fields
  const [functions, setFunctions] = useState<FunctionForm[]>([
    { name: "Reception", date: "", time: "19:00", venueName: "", venueAddress: "" },
  ]);

  function addFunction() {
    if (functions.length >= 10) return;
    const suggestions = FUNCTION_SUGGESTIONS.filter(
      (s) => !functions.some((f) => f.name === s)
    );
    setFunctions([
      ...functions,
      {
        name: suggestions[0] || "",
        date: "",
        time: "19:00",
        venueName: "",
        venueAddress: "",
      },
    ]);
  }

  function removeFunction(index: number) {
    setFunctions(functions.filter((_, i) => i !== index));
  }

  function updateFunction(index: number, field: keyof FunctionForm, value: string) {
    const updated = [...functions];
    updated[index] = { ...updated[index], [field]: value };
    setFunctions(updated);
  }

  async function handleCreate() {
    if (!user?.id) return;
    setSaving(true);
    try {
      // Create wedding
      const { data: wedding, error: weddingError } = await supabase
        .from("weddings")
        .insert({
          planner_id: user.id,
          wedding_name: weddingName,
          bride_name: brideName,
          groom_name: groomName,
          wedding_date: weddingDate,
          template_id: templateId,
        })
        .select()
        .single();

      if (weddingError) throw weddingError;

      // Create functions
      const functionsToInsert = functions.map((f, i) => ({
        wedding_id: wedding.id,
        name: f.name,
        date: f.date || weddingDate,
        time: f.time,
        venue_name: f.venueName,
        venue_address: f.venueAddress || null,
        sort_order: i + 1,
      }));

      const { error: funcError } = await supabase
        .from("wedding_functions")
        .insert(functionsToInsert);

      if (funcError) throw funcError;

      toast.success("Wedding created successfully! 🎉");
      router.push(`/wedding/${wedding.id}/guests`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create wedding. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canProceedStep1 = weddingName && brideName && groomName && weddingDate;
  const canProceedStep2 = functions.every((f) => f.name && f.venueName);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Create New Wedding</h1>

      {/* Progress Stepper */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-wedding-gold text-white"
                  : s < step
                  ? "bg-green-500 text-white"
                  : "bg-stone-200 text-stone-500"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div className={`h-0.5 w-12 ${s < step ? "bg-green-500" : "bg-stone-200"}`} />
            )}
          </div>
        ))}
        <span className="ml-3 text-sm text-muted-foreground">
          Step {step} of 3 —{" "}
          {step === 1 ? "Wedding Details" : step === 2 ? "Add Functions" : "Review & Create"}
        </span>
      </div>

      {/* Step 1: Wedding Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Wedding Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1 block">
                Wedding Name *
              </label>
              <Input
                placeholder='e.g., "Sharma–Kapoor Wedding"'
                value={weddingName}
                onChange={(e) => setWeddingName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">
                  Bride&apos;s Name *
                </label>
                <Input
                  placeholder="Priya Sharma"
                  value={brideName}
                  onChange={(e) => setBrideName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">
                  Groom&apos;s Name *
                </label>
                <Input
                  placeholder="Rahul Kapoor"
                  value={groomName}
                  onChange={(e) => setGroomName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 mb-1 block">
                Wedding Date *
              </label>
              <Input
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="bg-wedding-gold hover:bg-wedding-gold-light text-white gap-2"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Add Functions */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Add Functions / Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {functions.map((func, index) => (
              <div
                key={index}
                className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">
                    Function {index + 1}
                  </span>
                  {functions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFunction(index)}
                      className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">
                    Function Name *
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., Sangeet"
                      value={func.name}
                      onChange={(e) => updateFunction(index, "name", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {FUNCTION_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateFunction(index, "name", s)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          func.name === s
                            ? "bg-wedding-gold text-white border-wedding-gold"
                            : "bg-white text-stone-600 border-stone-300 hover:border-wedding-gold"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-stone-500 mb-1 block">Date</label>
                    <Input
                      type="date"
                      value={func.date}
                      onChange={(e) => updateFunction(index, "date", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-500 mb-1 block">Time</label>
                    <Input
                      type="time"
                      value={func.time}
                      onChange={(e) => updateFunction(index, "time", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">
                    Venue Name *
                  </label>
                  <Input
                    placeholder="e.g., The Leela Palace"
                    value={func.venueName}
                    onChange={(e) => updateFunction(index, "venueName", e.target.value)}
                  />
                </div>
              </div>
            ))}

            {functions.length < 10 && (
              <Button
                variant="outline"
                onClick={addFunction}
                className="w-full border-dashed border-stone-300 text-stone-500 gap-2"
              >
                <Plus className="h-4 w-4" /> Add Another Function
              </Button>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="bg-wedding-gold hover:bg-wedding-gold-light text-white gap-2"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-stone-50 rounded-xl space-y-2">
              <p className="text-sm text-stone-500">Wedding</p>
              <p className="font-semibold text-stone-900">{weddingName}</p>
              <p className="text-sm text-muted-foreground">
                {brideName} & {groomName}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(weddingDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-stone-500">Functions ({functions.length})</p>
              {functions.map((func, i) => (
                <div
                  key={i}
                  className="p-3 bg-stone-50 rounded-lg border border-stone-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-stone-800">{func.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {func.venueName}
                      {func.date && ` · ${new Date(func.date).toLocaleDateString("en-IN")}`}
                      {func.time && ` · ${func.time}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving}
                className="bg-wedding-gold hover:bg-wedding-gold-light text-white gap-2"
              >
                {saving ? "Creating..." : "Create Wedding 🎉"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
