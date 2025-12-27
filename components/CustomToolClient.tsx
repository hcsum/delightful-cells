"use client";

import Tool from "@/components/Tool";
import { useAuth } from "@/lib/auth/useAuth";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
  target: string;
  source: string;
};

export default function CustomToolClient({ initialTarget = "", initialSource = "" }: { initialTarget?: string; initialSource?: string }) {
  const { isAuthenticated } = useAuth();
  const form = useForm<FormValues>({
    defaultValues: { target: initialTarget, source: initialSource },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });
  const { register, watch, setError, clearErrors, formState: { errors }, getValues } = form;

  const target = watch('target');
  const source = watch('source');

  const promptTemplate = useMemo(() => {
    if (!target || !source) return '';
    return `From the following ${source} text, extract ${target}.\nIf not found, return null.`;
  }, [target, source]);

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
      {isAuthenticated && (
        <section className="space-y-2 mt-4 md:mt-6">
          <div className="flex flex-wrap gap-3 md:gap-4 items-center">
            <label className="text-base md:text-lg font-medium">Extract</label>
            <input
              {...register('target')}
              className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
              placeholder="TARGET (e.g., state, SKU, email)"
            />
            <label className="text-base md:text-lg font-medium">From</label>
            <input
              {...register('source')}
              className="bg-transparent border border-white/10 rounded px-3 py-2 text-base md:text-lg"
              placeholder="SOURCE (e.g., address, text, description)"
            />
          </div>
          {errors.target?.message || errors.source?.message ? (
            <p className="text-sm text-red-400">{errors.source?.message || errors.target?.message}</p>
          ) : null}
        </section>
      )}

      <Tool
        mode="custom"
        promptTemplate={promptTemplate}
        toBeExtracted={target || ''}
        extractFrom={source || ''}
        outputLabel={target || 'Extracted'}
        validatePrompt={validatePrompt}
        sourceHeader={source}
      />
    </>
  );
}
