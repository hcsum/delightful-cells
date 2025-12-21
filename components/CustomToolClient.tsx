"use client";

import Tool from "@/components/Tool";
import { buildCustomExtractor } from "@/lib/extractors";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
  target: string;
  source: string;
};

export default function CustomToolClient() {
  const form = useForm<FormValues>({
    defaultValues: { target: "", source: "" },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });
  const { register, watch, setError, clearErrors, formState: { errors }, getValues } = form;

  const target = watch('target');
  const source = watch('source');

  const promptTemplate = useMemo(() => {
    if (!target || !source) return "";
    return `From the following ${source} text, extract ${target}.\nIf not found, return null.`;
  }, [target, source]);

  const extractor = useMemo(() => buildCustomExtractor(target, source), [target, source]);

  const validatePrompt = (ctx?: { headers?: string[]; action: 'preview'|'download' }) => {
    const { target: tgtRaw, source: srcRaw } = getValues();
    const tgt = (tgtRaw || '').trim();
    const src = (srcRaw || '').trim();
    let ok = true;
    if (!tgt || !src) {
      setError('target', { message: 'Please fill both fields (Extract … from …)' });
      setError('source', { message: 'Please fill both fields (Extract … from …)' });
      ok = false;
    }
    if (ok && ctx?.headers) {
      const headers = ctx.headers.map((h) => h?.toString().trim().toLowerCase());
      const idx = headers.indexOf(src.toLowerCase());
      if (idx < 0) {
        setError('source', { message: `Column "${src}" not found in headers.` });
        ok = false;
      }
    }
    if (ok) clearErrors();
    return ok;
  };

  return (
    <>
      <section className="space-y-2">
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm">Extract</label>
          <input
            {...register('target')}
            className="bg-transparent border border-white/10 rounded p-1 text-sm"
            placeholder="TARGET (e.g., state, SKU, email)"
          />
          <label className="text-sm">from</label>
          <input
            {...register('source')}
            className="bg-transparent border border-white/10 rounded p-1 text-sm"
            placeholder="SOURCE (e.g., address, text, description)"
          />
        </div>
        {errors.target?.message || errors.source?.message ? (
          <p className="text-sm text-red-400">{errors.source?.message || errors.target?.message}</p>
        ) : null}
      </section>

      <Tool
        mode="custom"
        promptTemplate={promptTemplate}
        toBeExtracted={target || ''}
        extractFrom={source || ''}
        extractor={extractor}
        outputLabel={target || 'Extracted'}
        validatePrompt={validatePrompt}
        sourceHeader={source}
      />
    </>
  );
}
