"use client";

import { createAuthClient } from "better-auth/react";

// Relative URLs keep browser requests on the app's origin.
export const authClient = createAuthClient();
