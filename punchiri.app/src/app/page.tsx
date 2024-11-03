"use client";
import React, { useRef, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import dynamic from "next/dynamic"; // Dynamically import face-api.js

const EnhancedSmileDetector = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceapi, setFaceapi] = useState<any>(null);

  useEffect(() => {
    const loadFaceAPI = async () => {
      try {
        const faceapi = await import("face-api.js");
        setFaceapi(faceapi);

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);

        setModelsLoaded(true);
      } catch (error) {
        console.error("Error loading face-api:", error);
      }
    };

    loadFaceAPI();
    startVideo();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startVideo = async () => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const constraints = {
        video: {
          width: isMobile ? { ideal: 320 } : 640,
          height: isMobile ? { ideal: 240 } : 480,
          facingMode: "user",
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Camera access is not supported or was denied on this device.");
    }
  };

  const calculateSmileScore = (detection: any) => {
    const expressions = detection.expressions;
    const happyProbability = expressions.happy || 0;
    const smileScore = Math.round(happyProbability * 100);
    return smileScore;
  };

  const handlePlay = () => {
    if (!modelsLoaded || !faceapi) return;

    setIsDetecting(true);
    const interval = setInterval(async () => {
      if (!canvasRef.current || !videoRef.current || !modelsLoaded) return;

      const detections = await faceapi
        .detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 })
        )
        .withFaceLandmarks()
        .withFaceExpressions();

      const displaySize = {
        width: videoRef.current.width,
        height: videoRef.current.height,
      };

      faceapi.matchDimensions(canvasRef.current, displaySize);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (resizedDetections.length > 0) {
        const detection = resizedDetections[0];
        const box = detection.detection.box;

        // Draw face box
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw face landmarks
        faceapi.draw.drawFaceLandmarks(canvasRef.current, [detection]);

        // Calculate and update smile score using expressions
        const newScore = calculateSmileScore(detection);
        setScore(newScore);

        // Add expression text
        ctx.fillStyle = "#00ff00";
        ctx.font = "16px Arial";
        Object.entries(detection.expressions).forEach(
          ([expression, probability], index) => {
            const text = `${expression}: ${(probability as number).toFixed(2)}`;
            ctx.fillText(text, box.x, box.y - 10 - index * 20);
          }
        );
      }
    }, 100);

    return () => clearInterval(interval);
  };

  const handleBrightnessChange = (value: number[]) => {
    setBrightness(value[0]);
    if (videoRef.current) {
      videoRef.current.style.filter = `brightness(${value[0]}%)`;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="flex-grow container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">Punchiri.App</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Webcam Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <video
                  ref={videoRef}
                  width="640"
                  height="480"
                  autoPlay
                  muted
                  onPlay={handlePlay}
                  className="rounded-lg shadow-lg"
                />
                <canvas
                  ref={canvasRef}
                  width="640"
                  height="480"
                  className="absolute top-0 left-0"
                />
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="brightness">Brightness</Label>
                  <Slider
                    id="brightness"
                    min={50}
                    max={150}
                    step={1}
                    value={[brightness]}
                    onValueChange={handleBrightnessChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smile Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-6xl font-bold text-center mb-4">{score}</div>
              <p className="text-center text-gray-600 dark:text-gray-400">
                Your current smile score
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default EnhancedSmileDetector;
