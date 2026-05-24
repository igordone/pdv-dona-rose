import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { FeedbackProvider } from "../components/Feedback";
import "../styles/globals.css";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <FeedbackProvider>
        <Component {...pageProps} />
      </FeedbackProvider>
    </SessionProvider>
  );
}
