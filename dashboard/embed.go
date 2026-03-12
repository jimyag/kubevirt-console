package main

import "embed"

//go:embed ui/dist/*
var uiContent embed.FS
