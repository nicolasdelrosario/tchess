#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./ui/App.js";
import { parseCliArgs } from "./cliArgs.js";

render(<App config={parseCliArgs()} />);
