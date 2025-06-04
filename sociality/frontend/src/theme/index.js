/**
 * Main theme configuration
 * Exports the complete theme configuration for the application
 */
import { extendTheme } from "@chakra-ui/theme-utils";
import { config } from "./config";
import { styles } from "./styles";
import { colors } from "./colors";

// Create and export the theme
const theme = extendTheme({ config, styles, colors });

export default theme;
