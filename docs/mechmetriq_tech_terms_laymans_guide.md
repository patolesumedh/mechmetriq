---
title: "MECHmetrIQ — The Non-Tech Founder's Plain English Tech Glossary"
document_type: "Educational Guide & Reference Glossary"
version: "2.1.0"
date: "2026-11-02"
author: "Lakshman Shrinivasan"
audience: "Founders, Non-Technical Executives, Mechanical Engineers, Product Managers"
domains_covered:
  - "Web Architecture (Frontend, Backend, APIs, Database)"
  - "Cloud & Security (Serverless, Docker, S3, KMS, WAF, RLS, DDoS)"
  - "Manufacturing & CAD (ISO 10303 STEP AP242, OpenCASCADE, GD&T, Ra, DFM, CAPP)"
status: "Living Document"
---

# MECHmetrIQ — The Non-Tech Founder's Plain English Tech Glossary

> **Who this is for:** Founders, mechanical engineers, and creators building products using "vibe coding" (prompting AI tools like Cursor, Claude, ChatGPT, v0, Lovable) who want to understand what the architecture plans actually mean without getting lost in jargon.
>
> **Core Analogy:** Think of building a software business like building a high-end restaurant or a precision manufacturing factory.

---

## Quick Navigation
1. [The "Vibe Coding" Reality Check](#1-the-vibe-coding-reality-check)
2. [How the Web Actually Works (The Restaurant Analogy)](#2-how-the-web-actually-works)
3. [Cloud Hosting & Servers (The Kitchen & Real Estate)](#3-cloud-hosting--servers)
4. [Files & CAD Uploads (The Warehouse & Security Guards)](#4-files--cad-uploads)
5. [Databases & Memory (The Filing Cabinets & Whiteboards)](#5-databases--memory)
6. [Security & IP Protection (The Vault & Bouncers)](#6-security--ip-protection)
7. [Scale & Traffic (Handling the Lunch Rush)](#7-scale--traffic)
8. [CAD & Manufacturing Tech (The Factory Floor)](#8-cad--manufacturing-tech)
9. [Developer Operations (The Blueprint & Automation)](#9-developer-operations)

---

## 1. The "Vibe Coding" Reality Check

### What is "Vibe Coding"?
* **Plain English:** You describe what you want in plain words to an AI (like Cursor, Claude, ChatGPT, or Lovable), and it spits out working code.
* **The Good:** You can build a gorgeous, working prototype in days instead of months.
* **The Trap:** AI models write code that works *for one person sitting on localhost (your laptop)*. They don't automatically build the "industrial plumbing" (security fences, high-traffic valves, automatic emergency backups, leak-proof vaults). 
* **Why the Architecture Documents Exist:** The previous plans don't rewrite your smart pricing math. They build the **industrial piping and steel vault** around your AI-generated code so it doesn't crash or get hacked when 500 customers use it simultaneously.

---

## 2. How the Web Actually Works
*Think of a fine dining restaurant:*

```
[ Customer at Table ]  --->  [ Waiter (API) ]  --->  [ Kitchen Chef (Backend Server) ]
      (Frontend)                    |                         |
                               (Orders Ticket)       (Grabs ingredients from Fridge)
                                                              |
                                                    [ Fridge (Database) ]
```

### Frontend (Client-Side)
* **What it is:** The dining room, menu card, and tableware.
* **In MECHmetrIQ:** The visual web pages your customer sees in their browser (buttons, material dropdowns, 3D file viewer, price counter).
* **Technologies used:** React, Next.js, Tailwind CSS, HTML/JavaScript.

### Backend (Server-Side)
* **What it is:** The kitchen behind closed doors. The customer never sees it.
* **In MECHmetrIQ:** The secret engine where the real business logic runs — calculating exact machining time, applying confidential profit margins, saving passwords, and checking credit card payments.
* **Why it matters:** **Never put your secret pricing formulas or database passwords in the frontend!** Anyone can right-click any webpage, click "Inspect Element", and read all frontend code. Secrets *must* live strictly on the backend.

### API (Application Programming Interface)
* **What it is:** The waiter taking notes on a notepad.
* **Plain English:** A standardized way for the frontend (the customer) to ask the backend (the kitchen) for something: *"Hey backend, here is a 50mm Aluminum cube, calculate the quote."* The backend computes it and hands the waiter a receipt to take back to the screen.

### Endpoint / Route
* **What it is:** A specific bell on the counter for different requests.
* **Example:** `POST /api/quotes` is the bell for "create a new quote", while `GET /api/orders` is the bell for "show me my past orders".

---

## 3. Cloud Hosting & Servers

### Server
* **What it is:** A computer without a screen, sitting in an Amazon or Google data center, turned on 24/7, waiting to answer visitor requests.

### Localhost vs. Production
* **Localhost:** Running the app on your personal laptop. Only you can see it.
* **Production:** The live, public website reachable on the internet (e.g., `mechmetriq.com`).

### Docker / Containers
* **Analogy:** Standardized shipping containers on a cargo ship.
* **The Problem it solves:** "It worked on my laptop, but broke when I uploaded it to the cloud!"
* **Plain English:** A container wraps your code, the exact version of Node.js or Python, and all required system files into a sealed box. Whether it runs on Windows, Mac, AWS, or Google Cloud, it runs 100% identically.

### Serverless & "Scale-to-Zero"
* **Analogy:** An on-demand taxi (Uber) vs. leasing a car 24/7.
* **Old Way (Virtual Machine / EC2):** You rent a server computer for $100/month. Even at 3 AM when zero users visit, you pay for every single second it sits idle.
* **Serverless (GCP Cloud Run / AWS Lambda):** The server stays asleep ($0 cost). When a customer clicks "Upload CAD", Google boots up the server in 1 second, processes the quote, and if no one visits for 15 minutes, it goes back to sleep. You only pay for the exact seconds CPU was doing work.

### Cold Start
* **Analogy:** Starting an old car engine on a freezing winter morning.
* **Plain English:** When a serverless app "wakes up from zero", the first user might wait 2–3 extra seconds for the server to boot. Once awake, it answers instantly for everyone.

### Free-Tier "Spin Down" (Why Render Free Tier Fails)
* **Plain English:** Platforms like Render or Heroku offer free plans, but after 15 minutes of silence, they pull the plug on your server. When a client visits, the site can take 50+ seconds just to load, or fail entirely if memory runs out. That is why free tiers are fatal for B2B industrial clients.

---

## 4. Files & CAD Uploads (The Warehouse)

```
[ Customer Browser ] =====================================> [ S3 / Cloud Storage ]
        |                                                              ^
        | 1. "Can I upload part.step?"                                 |
        v                                                              | 3. Direct upload
[ Your Web Server ] --- 2. Issues one-time temporary key (Pre-signed) -+
```

### Object Storage / Blob Storage (AWS S3 or Google Cloud Storage)
* **Analogy:** A giant, indestructible digital warehouse with infinite shelves.
* **Why not save files on the web server?** If your web server crashes or restarts, any files saved directly on its hard drive disappear forever. Also, web servers get overwhelmed quickly. Object storage never runs out of space, never loses files (99.999999999% durability), and costs pennies.

### Pre-Signed URLs (Direct Upload) — *CRITICAL FOR CAD APPS*
* **The Rookie Mistake:** The user uploads a 150MB CAD file to your web server, and your web server re-uploads it to Amazon S3. If 5 users upload at once, your web server freezes and crashes.
* **The Pro Way (Pre-signed URL):** 
  1. The user's browser asks your server: *"I have a 100MB file called bracket.step, give me a temporary pass."*
  2. Your server validates who they are and hands them a cryptographically signed ticket that expires in 15 minutes.
  3. The browser uploads the heavy CAD file **directly** to the Amazon S3 warehouse.
* **Result:** Your web server does zero heavy lifting, doesn't crash, and never bottlenecks bandwidth.

---

## 5. Databases & Memory (Storage)

### Relational Database (PostgreSQL / Supabase)
* **Analogy:** A giant Excel workbook with multiple tabs (Users, Quotes, Orders, Materials) linked together with unbreakable rules.
* **Why it's needed:** You can ask questions like: *"Show me all Aluminum 6061 quotes generated by Customer X in the last 30 days that have not been paid yet."*

### Row Level Security (RLS)
* **Analogy:** A bank safety deposit room where every lock only accepts that specific customer's key.
* **Plain English:** A rule programmed right inside the database: *"Even if the web server makes a mistake, Customer A can NEVER see rows belonging to Customer B."* Essential for preventing data leaks between competing manufacturing clients.

### Redis / Cache / In-Memory Store (Upstash)
* **Analogy:** The sticky notes on a chef’s counter vs. walking down into the basement archive every time.
* **Plain English:** Normal databases write to physical hard drives (takes 10 to 50 milliseconds). Redis holds data in superfast RAM memory (takes 1 millisecond).
* **Where you use it:** 
  1. Material pricing (raw metal rates change once a day, so save them on a sticky note instead of querying the database 1,000 times).
  2. Rate limiting (keeping track of how many times an IP address clicked "Quote" in the last 60 seconds).

### Connection Pooling / PgBouncer
* **Analogy:** A company phone switchboard with 20 operators handling 500 callers by putting them in an orderly quick queue.
* **The Problem:** Databases crash if 200 server workers try to open 200 simultaneous direct telephone lines to it.
* **The Fix:** A connection pooler keeps 10–20 permanent lines open and shares them smoothly between thousands of incoming requests.

---

## 6. Security & IP Protection (The Vault)

```
[ Hacker / Bot ]       [ Legitimate Client ]
       |                       |
       v                       v
[ Cloudflare WAF / DDoS Shield (The Bouncer) ]
       |
       v  (Only clean traffic enters)
[ Encrypted HTTPS / TLS Tunnel (Armored Van) ]
       |
       v
[ Encrypted Storage (KMS / AES-256) (Bank Vault) ]
```

### Encryption "In Transit" (HTTPS / TLS / SSL)
* **Analogy:** Transporting cash inside an armored, opaque van instead of an open bicycle basket.
* **Plain English:** When a client sends a 3D CAD design over the Wi-Fi at a cafe, anyone snooping on the network only sees gibberish. Only your server and their browser have the secret decryption key.

### Encryption "At Rest" (AES-256 / KMS)
* **Analogy:** Keeping gold in a combination safe inside a locked vault.
* **Plain English:** Even if someone physically walked into Amazon’s data center, stole the hard drive, and plugged it into their computer, all CAD files and passwords look like pure static noise without your master encryption key.

### DDoS (Distributed Denial of Service)
* **Analogy:** A competitor hires 1,000 fake pranksters to crowd your restaurant doorway so real paying customers can't get in.
* **Cloudflare:** A massive digital security guard stationed in front of your doorway that instantly recognizes and kicks out fake bots while letting real customers walk in freely.

### WAF (Web Application Firewall)
* **Analogy:** A metal detector at the airport terminal.
* **Plain English:** Scans every message coming into your site to stop hackers attempting SQL injections (trying to trick your database into revealing all user records) or malicious script uploads.

### Environment Variables (`.env`) & Secret Manager
* **Analogy:** Writing your bank PIN on a sticky note taped to your laptop screen vs. keeping it in your brain/safe.
* **Rule #1 of Coding:** **NEVER put passwords, database connection strings, or Stripe API keys inside your code files.** If you push your code to GitHub, bots will find your keys in 30 seconds and run up thousands of dollars on your cloud card. Keep secrets in `.env` files that are kept off GitHub, or in Google/AWS Secret Manager.

---

## 7. Scale & Traffic (Handling the Lunch Rush)

### Concurrency vs. Throughput vs. Latency
* **Latency:** How fast one single customer gets their quote (e.g., 1.5 seconds).
* **Concurrency:** How many customers are clicking buttons on the website *at the very same second* (e.g., 500 users at 2:00 PM).
* **Throughput:** How many total orders your system can complete in one hour (e.g., 10,000 quotes/hour).

### Load Balancer
* **Analogy:** A traffic cop standing at a multi-lane highway fork waving cars into lane 1, lane 2, or lane 3 depending on which is least crowded.
* **Plain English:** Distributes incoming web traffic across multiple clone copies of your server so no single server gets overwhelmed.

### CDN (Content Delivery Network) & Edge Caching
* **Analogy:** Storing copies of your restaurant's printed menu at newsstands on every street corner instead of making everyone travel to your central office just to read it.
* **Plain English:** If your main server is in Mumbai, a user in Germany would normally wait for data to travel across undersea cables. A CDN stores your website's logos, styling, and JavaScript files in 300+ cities worldwide so the page loads in milliseconds everywhere.

### Background Worker / Asynchronous Queue (BullMQ / Cloud Tasks / Celery)
* **Analogy:** Fast food drive-thru: *"Please pull your car into Spot #2 while we fry your chicken. We will bring it to your window when ready."*
* **The Problem:** Parsing a complex 3D CAD file takes 20 seconds. If your web server forces the user's browser to hold the line for 20 seconds, the browser will likely timeout or show an error.
* **The Solution:**
  1. The user uploads the file.
  2. The server says: *"Got it! Your Ticket ID is #9482. We are crunching the numbers."* (Takes 0.2 seconds).
  3. A dedicated background worker pulls Ticket #9482 from the queue, takes 20 seconds to measure the CAD volume and surface area, and writes the result.
  4. The web page updates automatically with the final quote.

---

## 8. CAD & Manufacturing Tech (The Factory Floor)

### STEP / STP / IGES / STL Files
* **STL:** A 3D file made of tiny flat triangles (mesh). Great for 3D printing, but poor for precision CNC machining because it doesn't store true geometric curves, threads, or exact tolerances.
* **STEP (ISO 10303 - .step / .stp):** The universal gold standard for industrial engineering (B-Rep or Boundary Representation). It stores mathematically perfect cylinders, planes, holes, and curves:
  * **AP203:** Basic 3D shapes and assemblies (older standard).
  * **AP214:** Adds colors, layers, and automotive assembly data.
  * **AP242:** The modern aerospace/defense standard that embeds 3D tolerances, surface finishes, and annotations directly into the 3D model (called PMI or Product & Manufacturing Information).

### GD&T (Geometric Dimensioning & Tolerancing — ASME Y14.5 / ISO 1101)
* **Analogy:** Telling an architect not just *"build a door 2 meters high"*, but *"make sure the door frame is perpendicular to the floor within 1 millimeter, or it will jam."*
* **Plain English:** Standard engineering symbols on drawings that control flatness, concentricity, parallelism, and runout so parts assemble together effortlessly.

### Surface Roughness ($Ra$ — ISO 21920)
* **Analogy:** Sandpaper grit numbers vs. mirror polish.
* **Plain English:** Measured in micrometers ($\mu\text{m}$), where $1\,\mu\text{m} = 0.001\,\text{mm}$ (~1/70th of a human hair):
  * **$Ra \ge 6.3\,\mu\text{m}$:** Rough saw-cut or raw turned surface (visible tool marks).
  * **$Ra \approx 1.6\text{--}3.2\,\mu\text{m}$:** Standard precision CNC finish (smooth to the touch, light machine sheen).
  * **$Ra \le 0.8\,\mu\text{m}$:** Precision ground or fine-bored surface for oil seals and bearings.

### CAPP (Computer-Aided Process Planning)
* **Analogy:** The master machinist's recipe book.
* **Plain English:** Instead of just measuring part volume, CAPP decides *how* to build it: which face to clamp in the chuck first (Setup 1), what drill sizes to use, which tool turns the OD, and when to flip the part (Setup 2).

### Geometry Kernel (OpenCASCADE / CadQuery)
* **Analogy:** The digital calipers and micrometer software.
* **Plain English:** The heavy math engine that inspects a STEP file and calculates:
  * Exact cubic volume (mm³)
  * Total surface area (mm²)
  * Bounding box dimensions (Length × Width × Height)
  * Number of distinct holes, pockets, and undercut faces

### DFM (Design for Manufacturability)
* **Analogy:** A veteran CNC machinist looking over an engineer's drawing and saying: *"You can't machine this corner because our cutting tool is round, not square"* or *"This wall is too thin (0.4mm); it will bend and vibrate while cutting."*
* **In Software:** Automated algorithms that detect impossible or expensive geometry *before* manufacturing starts, warning the client in real-time.

### Three.js / WebGL
* **Plain English:** The 3D graphics engine built right into web browsers. It lets your client rotate, pan, and zoom their 3D metal bracket smoothly on screen without installing software like AutoCAD or SolidWorks.

---

## 9. Developer Operations (The Blueprint & Automation)

### CI/CD (Continuous Integration / Continuous Deployment)
* **Analogy:** An automated car assembly inspection line.
* **Plain English:** Whenever you or your AI changes code and saves it to GitHub, an automated script runs tests to make sure nothing is broken. If all tests pass, it automatically updates the live website with zero downtime.

### Infrastructure as Code (Terraform)
* **Analogy:** A 3D CAD blueprint for your entire cloud setup.
* **Without it:** Clicking 70 different buttons in the AWS/Google Cloud console, hoping you didn't forget a checkbox or security rule.
* **With it:** A single text file that says *"Build 2 servers, 1 database, 1 S3 storage bucket, and connect them with these firewall rules."* You type one command, and cloud providers assemble the whole thing identically in 5 minutes.

---

## Summary Cheat Sheet for Founders

| If someone says... | What they really mean is... | Why your business cares |
| :--- | :--- | :--- |
| **"Scale-to-Zero"** | Turn off the computer when no one is using it | Saves you 80% on monthly server bills |
| **"Pre-Signed URLs"** | Upload directly to the file warehouse, bypassing our app | Keeps your website fast and prevents crashes |
| **"Background Worker"** | Do heavy 3D math on a separate machine in the background | Users never see a spinning frozen screen |
| **"Row Level Security (RLS)"** | Lock database rows with customer IDs | Prevents Client A from ever seeing Client B's secret CAD drawings |
| **"Cloudflare WAF"** | A digital bouncer blocking hackers and bots | Keeps your servers safe and prevents expensive DDoS attacks |
| **"Redis Cache"** | Super-fast sticky notes in RAM memory | Speeds up quote generation from seconds to milliseconds |
| **"Container (Docker)"** | Software in an identical sealed shipping box | Runs the same everywhere; eliminates mystery bugs |

---

> 💡 **Tip for Vibe Coding with AI:**
> When prompting Cursor or Claude to add new features, use these terms directly! For example:
> *"Implement direct S3 upload using pre-signed URLs in Next.js instead of receiving the file buffer in our API route."*
> The AI will instantly produce much cleaner, production-grade code.
