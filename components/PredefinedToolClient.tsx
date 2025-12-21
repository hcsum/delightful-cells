"use client";

import Tool from "@/components/Tool";
import {
  extractCityFromAddress,
  extractNumbersFromText,
  extractStateFromAddress,
  extractTextFromCell,
  extractZipFromAddress,
  extractFirstNameFromFullName,
  extractLastNameFromFullName,
  extractTitleFromName,
  extractDomainFromEmail,
  extractUsernameFromEmail,
  PREDEFINED_EXTRACTION_MAP,
} from "@/lib/extractors";
import { useMemo } from "react";

type Kind =
  | "state"
  | "city"
  | "numbers"
  | "text"
  | "zip"
  | "firstName"
  | "lastName"
  | "titleFromName"
  | "domainFromEmail"
  | "usernameFromEmail";

export default function PredefinedToolClient({
  kind,
  promptTemplate,
}: {
  kind: Kind;
  promptTemplate: string;
}) {
  const extractor = useMemo(() => {
    switch (kind) {
      case "state":
        return extractStateFromAddress;
      case "city":
        return extractCityFromAddress;
      case "numbers":
        return extractNumbersFromText;
      case "text":
        return extractTextFromCell;
      case "zip":
        return extractZipFromAddress;
      case "firstName":
        return extractFirstNameFromFullName;
      case "lastName":
        return extractLastNameFromFullName;
      case "titleFromName":
        return extractTitleFromName;
      case "domainFromEmail":
        return extractDomainFromEmail;
      case "usernameFromEmail":
        return extractUsernameFromEmail;
      default:
        return (s: string) => s || null;
    }
  }, [kind]);

  const outputLabel = useMemo(() => {
    switch (kind) {
      case 'state':
        return 'State';
      case 'city':
        return 'City';
      case 'numbers':
        return 'Numbers';
      case 'text':
        return 'Text';
      case 'zip':
        return 'ZIP / Postal Code';
      case 'firstName':
        return 'First Name';
      case 'lastName':
        return 'Last Name';
      case 'titleFromName':
        return 'Title';
      case 'domainFromEmail':
        return 'Domain';
      case 'usernameFromEmail':
        return 'Username';
      default:
        return 'Extracted';
    }
  }, [kind]);

  const extractionParams = PREDEFINED_EXTRACTION_MAP[kind];
  
  return <Tool mode="predefined" promptTemplate={promptTemplate} toBeExtracted={extractionParams.toBeExtracted} extractFrom={extractionParams.extractFrom} extractor={extractor} outputLabel={outputLabel} />;
}
