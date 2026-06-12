# Feedback & Beta System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public feedback page, beta banner, floating feedback button, creator contact card, and admin feedback viewer — using the existing Spring Boot + PostgreSQL backend.

**Architecture:** New `feedback` feature package in Spring Boot (entity/repo/service/controller). `POST /api/feedback` is public (no auth). `GET /api/admin/feedback` is admin-only. Frontend uses the existing `api` axios client. No Supabase — everything goes into the existing database.

**Tech Stack:** Spring Boot, JPA/Hibernate, PostgreSQL, React 19, Vite, lucide-react, react-router-dom

**Spec:** `docs/superpowers/specs/2026-05-20-feedback-beta-system-design.md`

---

## File Map

### Backend
| Action | Path | Purpose |
|---|---|---|
| Create | `backend/src/main/java/com/towin/feedback/entity/Feedback.java` | JPA entity |
| Create | `backend/src/main/java/com/towin/feedback/repository/FeedbackRepository.java` | Spring Data repo |
| Create | `backend/src/main/java/com/towin/feedback/dto/FeedbackRequest.java` | Incoming DTO |
| Create | `backend/src/main/java/com/towin/feedback/dto/FeedbackResponse.java` | Outgoing DTO |
| Create | `backend/src/main/java/com/towin/feedback/service/FeedbackService.java` | Business logic |
| Create | `backend/src/main/java/com/towin/feedback/controller/FeedbackController.java` | REST endpoints |
| Modify | `backend/src/main/java/com/towin/common/security/SecurityConfig.java` | Permit POST /api/feedback |

### Frontend
| Action | Path | Purpose |
|---|---|---|
| Create | `frontend/src/components/BetaBanner.jsx` | Dismissible beta banner |
| Create | `frontend/src/components/FeedbackWidget.jsx` | Floating feedback pill |
| Create | `frontend/src/pages/Feedback.jsx` | Creator card + star-rating form |
| Modify | `frontend/src/App.jsx` | Add /feedback route, BetaBanner, FeedbackWidget |
| Modify | `frontend/src/pages/Login.jsx` | Add "Share feedback" link |
| Modify | `frontend/src/pages/Admin.jsx` | Add "Feedback" tab |

---

## Chunk 1: Backend Feedback Feature

### Task 1: Feedback entity, repo, DTOs, service, controller

**Files:**
- Create: `backend/src/main/java/com/towin/feedback/entity/Feedback.java`
- Create: `backend/src/main/java/com/towin/feedback/repository/FeedbackRepository.java`
- Create: `backend/src/main/java/com/towin/feedback/dto/FeedbackRequest.java`
- Create: `backend/src/main/java/com/towin/feedback/dto/FeedbackResponse.java`
- Create: `backend/src/main/java/com/towin/feedback/service/FeedbackService.java`
- Create: `backend/src/main/java/com/towin/feedback/controller/FeedbackController.java`

- [ ] **Step 1: Create Feedback entity**

  Create `backend/src/main/java/com/towin/feedback/entity/Feedback.java`:

  ```java
  package com.towin.feedback.entity;

  import jakarta.persistence.*;
  import lombok.*;
  import java.time.LocalDateTime;
  import java.util.UUID;

  @Entity
  @Table(name = "feedback")
  @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
  public class Feedback {

      @Id
      @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      private String name;
      private String email;
      private String phone;

      @Column(nullable = false, columnDefinition = "TEXT")
      private String message;

      private Integer ratingIdea;
      private Integer ratingUi;
      private Integer ratingTheme;
      private Integer ratingSecurity;
      private Integer ratingEaseOfUse;
      private Integer ratingPerformance;
      private Integer ratingOverall;

      @Column(nullable = false, updatable = false)
      private LocalDateTime createdAt;

      @PrePersist
      void prePersist() { this.createdAt = LocalDateTime.now(); }
  }
  ```

- [ ] **Step 2: Create FeedbackRepository**

  Create `backend/src/main/java/com/towin/feedback/repository/FeedbackRepository.java`:

  ```java
  package com.towin.feedback.repository;

  import com.towin.feedback.entity.Feedback;
  import org.springframework.data.jpa.repository.JpaRepository;
  import java.util.UUID;

  public interface FeedbackRepository extends JpaRepository<Feedback, UUID> {}
  ```

- [ ] **Step 3: Create FeedbackRequest DTO**

  Create `backend/src/main/java/com/towin/feedback/dto/FeedbackRequest.java`:

  ```java
  package com.towin.feedback.dto;

  import jakarta.validation.constraints.NotBlank;
  import lombok.Data;

  @Data
  public class FeedbackRequest {
      private String name;
      private String email;
      private String phone;

      @NotBlank(message = "Message is required")
      private String message;

      private Integer ratingIdea;
      private Integer ratingUi;
      private Integer ratingTheme;
      private Integer ratingSecurity;
      private Integer ratingEaseOfUse;
      private Integer ratingPerformance;
      private Integer ratingOverall;
  }
  ```

- [ ] **Step 4: Create FeedbackResponse DTO**

  Create `backend/src/main/java/com/towin/feedback/dto/FeedbackResponse.java`:

  ```java
  package com.towin.feedback.dto;

  import lombok.Builder;
  import lombok.Data;
  import java.time.LocalDateTime;
  import java.util.UUID;

  @Data @Builder
  public class FeedbackResponse {
      private UUID id;
      private String name;
      private String email;
      private String phone;
      private String message;
      private Integer ratingIdea;
      private Integer ratingUi;
      private Integer ratingTheme;
      private Integer ratingSecurity;
      private Integer ratingEaseOfUse;
      private Integer ratingPerformance;
      private Integer ratingOverall;
      private LocalDateTime createdAt;
  }
  ```

- [ ] **Step 5: Create FeedbackService**

  Create `backend/src/main/java/com/towin/feedback/service/FeedbackService.java`:

  ```java
  package com.towin.feedback.service;

  import com.towin.feedback.dto.FeedbackRequest;
  import com.towin.feedback.dto.FeedbackResponse;
  import com.towin.feedback.entity.Feedback;
  import com.towin.feedback.repository.FeedbackRepository;
  import lombok.RequiredArgsConstructor;
  import org.springframework.data.domain.Sort;
  import org.springframework.stereotype.Service;

  import java.util.List;

  @Service
  @RequiredArgsConstructor
  public class FeedbackService {

      private final FeedbackRepository feedbackRepository;

      public void submit(FeedbackRequest req) {
          feedbackRepository.save(Feedback.builder()
              .name(req.getName())
              .email(req.getEmail())
              .phone(req.getPhone())
              .message(req.getMessage())
              .ratingIdea(req.getRatingIdea())
              .ratingUi(req.getRatingUi())
              .ratingTheme(req.getRatingTheme())
              .ratingSecurity(req.getRatingSecurity())
              .ratingEaseOfUse(req.getRatingEaseOfUse())
              .ratingPerformance(req.getRatingPerformance())
              .ratingOverall(req.getRatingOverall())
              .build());
      }

      public List<FeedbackResponse> getAll() {
          return feedbackRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
              .stream()
              .map(f -> FeedbackResponse.builder()
                  .id(f.getId())
                  .name(f.getName())
                  .email(f.getEmail())
                  .phone(f.getPhone())
                  .message(f.getMessage())
                  .ratingIdea(f.getRatingIdea())
                  .ratingUi(f.getRatingUi())
                  .ratingTheme(f.getRatingTheme())
                  .ratingSecurity(f.getRatingSecurity())
                  .ratingEaseOfUse(f.getRatingEaseOfUse())
                  .ratingPerformance(f.getRatingPerformance())
                  .ratingOverall(f.getRatingOverall())
                  .createdAt(f.getCreatedAt())
                  .build())
              .toList();
      }
  }
  ```

- [ ] **Step 6: Create FeedbackController**

  Create `backend/src/main/java/com/towin/feedback/controller/FeedbackController.java`:

  ```java
  package com.towin.feedback.controller;

  import com.towin.feedback.dto.FeedbackRequest;
  import com.towin.feedback.dto.FeedbackResponse;
  import com.towin.feedback.service.FeedbackService;
  import jakarta.validation.Valid;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.ResponseEntity;
  import org.springframework.web.bind.annotation.*;

  import java.util.List;

  @RestController
  @RequiredArgsConstructor
  public class FeedbackController {

      private final FeedbackService feedbackService;

      @PostMapping("/api/feedback")
      public ResponseEntity<Void> submit(@Valid @RequestBody FeedbackRequest req) {
          feedbackService.submit(req);
          return ResponseEntity.ok().build();
      }

      @GetMapping("/api/admin/feedback")
      public ResponseEntity<List<FeedbackResponse>> getAll() {
          return ResponseEntity.ok(feedbackService.getAll());
      }
  }
  ```

- [ ] **Step 7: Permit POST /api/feedback in SecurityConfig**

  In `backend/src/main/java/com/towin/common/security/SecurityConfig.java`, find:

  ```java
  .requestMatchers("/api/auth/**").permitAll()
  .requestMatchers("/ws/**").permitAll()
  ```

  Replace with:

  ```java
  .requestMatchers("/api/auth/**").permitAll()
  .requestMatchers("/ws/**").permitAll()
  .requestMatchers("/api/feedback").permitAll()
  ```

- [ ] **Step 8: Build and verify**

  ```bash
  cd backend && ./mvnw compile
  ```

  Expected: BUILD SUCCESS with no errors.

- [ ] **Step 9: Commit**

  ```bash
  git add backend/src/main/java/com/towin/feedback/ backend/src/main/java/com/towin/common/security/SecurityConfig.java
  git commit -m "feat: add feedback feature - entity, repo, service, controller"
  ```

---

## Chunk 2: Frontend Global Components

### Task 2: BetaBanner + FeedbackWidget + App.jsx wiring

**Files:**
- Create: `frontend/src/components/BetaBanner.jsx`
- Create: `frontend/src/components/FeedbackWidget.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create BetaBanner**

  Create `frontend/src/components/BetaBanner.jsx`:

  ```jsx
  import { useState } from 'react';
  import { useNavigate } from 'react-router-dom';

  const STORAGE_KEY = 'towin_beta_banner_dismissed';

  export default function BetaBanner() {
    const [visible, setVisible] = useState(
      () => localStorage.getItem(STORAGE_KEY) !== 'true'
    );
    const navigate = useNavigate();

    if (!visible) return null;

    const dismiss = () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      setVisible(false);
    };

    return (
      <div style={{
        width: '100%',
        background: '#4FA3CE',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 20px',
        fontSize: '14px',
        fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
        position: 'relative',
        zIndex: 1000,
        boxSizing: 'border-box',
      }}>
        <span>
          ToWin is in beta — your feedback helps us improve.{' '}
          <button
            onClick={() => navigate('/feedback')}
            style={{
              background: 'none', border: 'none', color: '#fff',
              fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
              fontSize: '14px', fontFamily: 'inherit', padding: 0,
            }}
          >
            Give Feedback →
          </button>
        </span>
        <button
          onClick={dismiss}
          aria-label="Dismiss beta banner"
          style={{
            position: 'absolute', right: '16px',
            background: 'none', border: 'none', color: '#fff',
            fontSize: '18px', cursor: 'pointer', lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create FeedbackWidget**

  Create `frontend/src/components/FeedbackWidget.jsx`:

  ```jsx
  import { useNavigate, useLocation } from 'react-router-dom';
  import { Pencil } from 'lucide-react';

  export default function FeedbackWidget() {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    if (pathname === '/feedback') return null;

    return (
      <button
        onClick={() => navigate('/feedback')}
        aria-label="Give feedback"
        style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#4FA3CE',
          color: '#fff',
          border: 'none',
          borderRadius: '9999px',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: `-apple-system, 'SF Pro Text', system-ui, sans-serif`,
          boxShadow: '0 4px 20px rgba(79,163,206,0.4)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.04)';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(79,163,206,0.55)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,163,206,0.4)';
        }}
      >
        <Pencil size={15} />
        Give Feedback
      </button>
    );
  }
  ```

- [ ] **Step 3: Wire into App.jsx**

  Add these imports to `frontend/src/App.jsx`:

  ```jsx
  import BetaBanner from './components/BetaBanner';
  import FeedbackWidget from './components/FeedbackWidget';
  import Feedback from './pages/Feedback';
  ```

  Replace the `return` block in the `App` function with:

  ```jsx
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <BetaBanner />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfileEdit /></PrivateRoute>} />
            <Route path="/emergency-contacts" element={<ElderOnly><EmergencyContacts /></ElderOnly>} />
            <Route path="/messages" element={<PrivateRoute><MessagesInbox /></PrivateRoute>} />
            <Route path="/messages/:connectionId" element={<PrivateRoute><Messages /></PrivateRoute>} />
            <Route path="/streaks" element={<ElderOnly><Streaks /></ElderOnly>} />
            <Route path="/game" element={<PrivateRoute><PeekabooGame /></PrivateRoute>} />
            <Route path="/trust" element={<PrivateRoute><Trust /></PrivateRoute>} />
            <Route path="/user/:id" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <FeedbackWidget />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
  ```

- [ ] **Step 4: Verify dev server starts**

  ```bash
  cd frontend && npm run dev
  ```

  Navigate to `/login` — banner appears at top, floating button bottom-right.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/BetaBanner.jsx frontend/src/components/FeedbackWidget.jsx frontend/src/App.jsx
  git commit -m "feat: add BetaBanner and FeedbackWidget to all pages"
  ```

---

## Chunk 3: Feedback Page

### Task 3: Creator contact card + star rating form

**Files:**
- Create: `frontend/src/pages/Feedback.jsx`

- [ ] **Step 1: Create Feedback.jsx**

  Create `frontend/src/pages/Feedback.jsx`:

  ```jsx
  import { useState } from 'react';
  import api from '../api/axios';
  import { Mail, Phone, MapPin, Linkedin, Github, Instagram, Globe, Star } from 'lucide-react';

  const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
  const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

  const RATINGS = [
    { key: 'ratingIdea', label: 'Idea (concept)' },
    { key: 'ratingUi', label: 'UI' },
    { key: 'ratingTheme', label: 'Theme' },
    { key: 'ratingSecurity', label: 'Security' },
    { key: 'ratingEaseOfUse', label: 'Ease of Use' },
    { key: 'ratingPerformance', label: 'Performance' },
    { key: 'ratingOverall', label: 'Overall' },
  ];

  const SOCIALS = [
    { icon: Mail, label: 'agharsha.anbu@gmail.com', href: 'mailto:agharsha.anbu@gmail.com' },
    { icon: Phone, label: '+1 438-535-5782 (WhatsApp)', href: 'https://wa.me/14385355782' },
    { icon: MapPin, label: 'Montreal, Quebec, Canada', href: null },
    { icon: Linkedin, label: 'harsha-anbu-gowri', href: 'https://www.linkedin.com/in/harsha-anbu-gowri/' },
    { icon: Github, label: 'Harsha-anbu-g', href: 'https://github.com/Harsha-anbu-g' },
    { icon: Instagram, label: 'harsha._.ag', href: 'https://www.instagram.com/harsha._.ag' },
    { icon: Globe, label: 'portfolioharsha.vercel.app', href: 'https://portfolioharsha.vercel.app/' },
  ];

  function StarRating({ value, onChange }) {
    const [hovered, setHovered] = useState(0);
    return (
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map(n => {
          const filled = n <= (hovered || value);
          return (
            <Star
              key={n}
              size={24}
              fill={filled ? '#4FA3CE' : 'none'}
              color={filled ? '#4FA3CE' : '#d0d0d5'}
              style={{ cursor: 'pointer', transition: 'color 0.1s' }}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(value === n ? 0 : n)}
            />
          );
        })}
      </div>
    );
  }

  function CreatorCard() {
    return (
      <div style={{
        background: '#fff', borderRadius: '18px',
        padding: '32px 36px', border: '1px solid #e0e0e0', marginBottom: '20px',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontFamily: SF, fontSize: '22px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
            Harshavardhan Anbuchezhian Gowri
            <span style={{ fontWeight: 400, color: '#7a7a7a', fontSize: '18px' }}> (Harsha)</span>
          </h2>
          <p style={{ fontFamily: SFText, fontSize: '14px', color: '#4FA3CE', fontWeight: 600, margin: '0 0 2px' }}>
            Full-Stack Engineer
          </p>
          <p style={{ fontFamily: SFText, fontSize: '13px', color: '#7a7a7a', margin: 0 }}>
            Master's in Applied Computer Science · Concordia University, Montreal
          </p>
        </div>

        <div style={{ height: '1px', background: '#e0e0e0', margin: '16px 0' }} />

        <p style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.5 }}>
          This isn't a university project — ToWin is my future startup. I'm building something real, and your feedback is what shapes it.
        </p>
        <p style={{ fontFamily: SFText, fontSize: '14px', color: '#7a7a7a', margin: '0 0 20px', lineHeight: 1.6 }}>
          Fill in the form below, or drop your feedback directly on any of my socials. Love the idea? Want to connect or collaborate? Let's connect!
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SOCIALS.map(({ icon: Icon, label, href }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon size={16} color="#4FA3CE" style={{ flexShrink: 0 }} />
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: SFText, fontSize: '14px', color: '#4FA3CE', textDecoration: 'none' }}>
                  {label}
                </a>
              ) : (
                <span style={{ fontFamily: SFText, fontSize: '14px', color: '#7a7a7a' }}>{label}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  export default function Feedback() {
    const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
    const [ratings, setRatings] = useState({});
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const setRating = (key, val) => setRatings(r => ({ ...r, [key]: val || null }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.message.trim()) { setError('Please write a message before submitting.'); return; }
      setError('');
      setLoading(true);
      try {
        await api.post('/feedback', {
          name: form.name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          message: form.message.trim(),
          ...Object.fromEntries(RATINGS.map(({ key }) => [key, ratings[key] || null])),
        });
        setSubmitted(true);
      } catch {
        setError('Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const inputStyle = {
      width: '100%', padding: '10px 14px', borderRadius: '10px',
      border: '1px solid #e0e0e0', fontSize: '15px', fontFamily: SFText,
      color: '#1d1d1f', background: '#fafafc', outline: 'none', boxSizing: 'border-box',
    };

    const labelStyle = {
      display: 'block', fontSize: '13px', fontWeight: 600,
      color: '#1d1d1f', marginBottom: '6px', fontFamily: SFText,
    };

    return (
      <div style={{ minHeight: '100svh', background: '#fafafc', padding: '48px 24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <CreatorCard />

          {submitted ? (
            <div style={{
              background: '#fff', borderRadius: '18px', padding: '48px 36px',
              border: '1px solid #e0e0e0', textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🙏</div>
              <h2 style={{ fontFamily: SF, fontSize: '26px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 10px' }}>
                Thank you!
              </h2>
              <p style={{ fontFamily: SFText, fontSize: '16px', color: '#7a7a7a', margin: 0 }}>
                Your feedback means a lot. It genuinely helps make ToWin better.
              </p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '18px', padding: '36px', border: '1px solid #e0e0e0' }}>
              <h2 style={{ fontFamily: SF, fontSize: '26px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px' }}>
                Share Your Feedback
              </h2>
              <p style={{ fontFamily: SFText, fontSize: '15px', color: '#7a7a7a', margin: '0 0 24px' }}>
                All fields are optional except your message.
              </p>

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
                  padding: '12px 16px', fontSize: '14px', color: '#dc2626',
                  marginBottom: '20px', fontFamily: SFText,
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Name <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span></label>
                  <input style={inputStyle} value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" />
                </div>
                <div>
                  <label style={labelStyle}>Email <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span></label>
                  <input type="email" style={inputStyle} value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
                </div>
                <div>
                  <label style={labelStyle}>Phone <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span></label>
                  <input type="tel" style={inputStyle} value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 000-000-0000" />
                </div>

                <div style={{ height: '1px', background: '#e0e0e0' }} />

                <div>
                  <p style={{ ...labelStyle, marginBottom: '14px' }}>
                    Rate the app <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {RATINGS.map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f', minWidth: '120px' }}>{label}</span>
                        <StarRating value={ratings[key] || 0} onChange={val => setRating(key, val)} />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: '#e0e0e0' }} />

                <div>
                  <label style={labelStyle}>Message <span style={{ color: '#dc2626' }}>*</span></label>
                  <textarea required rows={5}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us anything — bugs, ideas, impressions, anything at all..."
                  />
                </div>

                <button type="submit" disabled={loading} style={{
                  width: '100%', height: '48px',
                  background: loading ? '#7BB8D6' : '#4FA3CE',
                  color: '#fff', border: 'none', borderRadius: '9999px',
                  fontSize: '16px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: SFText, transition: 'background 0.15s',
                }}>
                  {loading ? 'Submitting…' : 'Submit Feedback'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Lint check**

  ```bash
  cd frontend && npm run lint
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/pages/Feedback.jsx
  git commit -m "feat: add Feedback page with creator card and star rating form"
  ```

---

## Chunk 4: Login Link + Admin Tab

### Task 4: "Share feedback" link on Login + Feedback tab in Admin

**Files:**
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/pages/Admin.jsx`

- [ ] **Step 1: Add "Share feedback" link to Login.jsx**

  In `frontend/src/pages/Login.jsx`, find the "Don't have an account?" paragraph and add a new paragraph immediately after it:

  ```jsx
  <p style={{
    textAlign: 'center', fontSize: '13px', color: '#a0a0a5',
    fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
    marginTop: '8px',
  }}>
    <Link to="/feedback" style={{ color: '#7a7a7a', textDecoration: 'none' }}>
      Share feedback
    </Link>
  </p>
  ```

- [ ] **Step 2: Add "Feedback" to TABS in Admin.jsx**

  Find:
  ```js
  const TABS = ['Users', 'Verifications', 'Reports', 'Reviews', 'Data'];
  ```
  Replace with:
  ```js
  const TABS = ['Users', 'Verifications', 'Reports', 'Reviews', 'Data', 'Feedback'];
  ```

- [ ] **Step 3: Add FeedbackTab component to Admin.jsx**

  Add the following imports at the top of Admin.jsx:
  ```js
  import api from '../api/axios';
  ```
  (Check if `api` is already imported — if so, skip this.)

  Add the `FeedbackTab` component before the default export in `Admin.jsx`:

  ```jsx
  const RATING_LABELS = [
    { key: 'ratingIdea', label: 'Idea' },
    { key: 'ratingUi', label: 'UI' },
    { key: 'ratingTheme', label: 'Theme' },
    { key: 'ratingSecurity', label: 'Security' },
    { key: 'ratingEaseOfUse', label: 'Ease' },
    { key: 'ratingPerformance', label: 'Perf' },
    { key: 'ratingOverall', label: 'Overall' },
  ];

  function avgRating(rows, key) {
    const vals = rows.map(r => r[key]).filter(v => v != null);
    if (!vals.length) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  function FeedbackTab() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      api.get('/admin/feedback')
        .then(({ data }) => setRows(data))
        .finally(() => setLoading(false));
    }, []);

    if (loading) return <p style={{ fontFamily: SFText, color: '#7a7a7a', padding: '24px' }}>Loading feedback…</p>;
    if (!rows.length) return <p style={{ fontFamily: SFText, color: '#7a7a7a', padding: '24px' }}>No feedback yet.</p>;

    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '28px',
          background: '#fff', borderRadius: '14px', padding: '16px 20px', border: '1px solid #e0e0e0',
        }}>
          {RATING_LABELS.map(({ key, label }) => {
            const a = avgRating(rows, key);
            return (
              <div key={key} style={{ textAlign: 'center', minWidth: '72px' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#4FA3CE', fontFamily: SF }}>
                  {a ?? '—'}
                </div>
                <div style={{ fontSize: '11px', color: '#7a7a7a', fontFamily: SFText }}>{label}</div>
              </div>
            );
          })}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SFText, fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f5f7', textAlign: 'left' }}>
                {['Date', 'Name', 'Email', 'Phone', ...RATING_LABELS.map(r => r.label), 'Message'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', color: '#1d1d1f', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 12px', color: '#7a7a7a', whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.name ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.email ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.phone ?? '—'}</td>
                  {RATING_LABELS.map(({ key }) => (
                    <td key={key} style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {r[key] != null ? `${r[key]} ⭐` : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '10px 12px', maxWidth: '240px', color: '#1d1d1f' }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Wire FeedbackTab into the Admin tab renderer**

  Find where other tabs are rendered (look for `tab === 'Users'`, `tab === 'Data'`, etc.) and add alongside them:

  ```jsx
  {tab === 'Feedback' && <FeedbackTab />}
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/pages/Login.jsx frontend/src/pages/Admin.jsx
  git commit -m "feat: add Share feedback link to Login, Feedback tab to Admin"
  ```

---

## Done Checklist

- [ ] `POST /api/feedback` works without auth — anyone can submit
- [ ] `GET /api/admin/feedback` requires ADMIN role
- [ ] BetaBanner appears on all pages, dismisses and stays dismissed
- [ ] FeedbackWidget floating button appears on all pages except `/feedback`
- [ ] `/feedback` shows creator card + star rating form, submits to backend
- [ ] "Share feedback" link on login page
- [ ] Admin "Feedback" tab shows averages + submissions table
