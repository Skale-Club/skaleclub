import type { LucideIcon } from "lucide-react";
import type { IconType } from "react-icons";

// Social marks are maintained by react-icons; Lucide only provides generic UI icons.
// Keep the historic export names so stored /links icon names continue to resolve.
export {
  SiInstagram as Instagram,
  SiFacebook as Facebook,
  SiYoutube as Youtube,
  SiGithub as Github,
  SiTwitch as Twitch,
} from "react-icons/si";
export { FaLinkedin as Linkedin, FaTwitter as Twitter } from "react-icons/fa";

/** Shared render contract for curated lists containing both UI and brand icons. */
export type SiteIcon = LucideIcon | IconType;
