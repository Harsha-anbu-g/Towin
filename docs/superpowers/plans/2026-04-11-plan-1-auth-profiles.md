# Plan 1: Project Setup + Auth + User Profiles

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full project (React frontend + Spring Boot backend + PostgreSQL), implement registration, login, JWT auth, and elder/helper profile creation.

**Architecture:** Spring Boot REST API with JWT security. React frontend with React Router and Axios. PostgreSQL with Spring Data JPA. Each backend module is a separate package with its own Controller, Service, Repository, and Entity.

**Tech Stack:** Java 21, Spring Boot 3, Spring Security, JWT (jjwt), PostgreSQL, Flyway (migrations), JUnit 5, Mockito, React 18, React Router 6, Axios, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-11-towin-platform-design.md`

---

## Chunk 1: Project Scaffold

### Task 1: Initialize Spring Boot Backend

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/com/towin/ToWinApplication.java`

- [ ] **Step 1: Generate Spring Boot project**

Go to https://start.spring.io and generate with:
- Project: Maven
- Language: Java 21
- Spring Boot: 3.x
- Group: com.towin
- Artifact: backend
- Dependencies: Spring Web, Spring Security, Spring Data JPA, PostgreSQL Driver, Validation, Lombok

Unzip into `backend/`

- [ ] **Step 2: Add JWT dependency to pom.xml**

Add inside `<dependencies>`:
```xml
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.3</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.3</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.3</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

- [ ] **Step 3: Configure application.yml**

`backend/src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/towin
    username: postgres
    password: postgres
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: true
    locations: classpath:db/migration

app:
  jwt:
    secret: your-256-bit-secret-change-this-in-production-must-be-long
    expiration-ms: 86400000

server:
  port: 8080
```

- [ ] **Step 4: Create main application class**

`backend/src/main/java/com/towin/ToWinApplication.java`:
```java
package com.towin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ToWinApplication {
    public static void main(String[] args) {
        SpringApplication.run(ToWinApplication.class, args);
    }
}
```

- [ ] **Step 5: Create PostgreSQL database**

```bash
psql -U postgres -c "CREATE DATABASE towin;"
```

- [ ] **Step 6: Verify app starts**

```bash
cd backend && mvn spring-boot:run
```
Expected: Spring Boot starts on port 8080, no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Spring Boot backend project"
```

---

### Task 2: Initialize React Frontend

**Files:**
- Create: `frontend/` (Vite React project)
- Create: `frontend/src/api/axios.js`
- Create: `frontend/src/main.jsx`

- [ ] **Step 1: Create Vite React project**

```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install axios react-router-dom @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

`frontend/tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontSize: {
        'elder': '1.25rem',
      }
    },
  },
  plugins: [],
}
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Create Axios instance**

`frontend/src/api/axios.js`:
```js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

- [ ] **Step 5: Verify frontend starts**

```bash
cd frontend && npm run dev
```
Expected: React app running on http://localhost:5173

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: initialize React frontend project"
```

---

## Chunk 2: Database Migrations

### Task 3: Create Initial Database Schema

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__create_users_table.sql`
- Create: `backend/src/main/resources/db/migration/V2__create_profiles_table.sql`
- Create: `backend/src/main/resources/db/migration/V3__create_emergency_contacts_table.sql`

- [ ] **Step 1: Create users migration**

`backend/src/main/resources/db/migration/V1__create_users_table.sql`:
```sql
CREATE TYPE user_role AS ENUM ('ELDER', 'HELPER', 'BOTH');
CREATE TYPE verification_status AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'ELDER',
    trust_score INTEGER NOT NULL DEFAULT 0,
    verification_status verification_status NOT NULL DEFAULT 'NONE',
    id_document_url VARCHAR(500),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    city VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_location ON users(location_lat, location_lng);
```

- [ ] **Step 2: Create profiles migration**

`backend/src/main/resources/db/migration/V2__create_profiles_table.sql`:
```sql
CREATE TABLE elder_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    photo_url VARCHAR(500),
    bio TEXT,
    interests TEXT[],
    languages TEXT[],
    looking_for VARCHAR(20) NOT NULL DEFAULT 'BOTH',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE helper_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    photo_url VARCHAR(500),
    bio TEXT,
    skills_offered TEXT[],
    languages TEXT[],
    availability_days TEXT[],
    availability_times TEXT[],
    background_check_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Create emergency contacts migration**

`backend/src/main/resources/db/migration/V3__create_emergency_contacts_table.sql`:
```sql
CREATE TABLE emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    inactivity_alert_days INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: Verify migrations run**

```bash
cd backend && mvn spring-boot:run
```
Expected: Flyway runs all 3 migrations, tables created in PostgreSQL.

Verify:
```bash
psql -U postgres -d towin -c "\dt"
```
Expected: users, elder_profiles, helper_profiles, emergency_contacts tables visible.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add initial database schema migrations"
```

---

## Chunk 3: Auth Backend

### Task 4: User Entity + Repository

**Files:**
- Create: `backend/src/main/java/com/towin/common/entity/User.java`
- Create: `backend/src/main/java/com/towin/auth/repository/UserRepository.java`

- [ ] **Step 1: Create User entity**

`backend/src/main/java/com/towin/common/entity/User.java`:
```java
package com.towin.common.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(unique = true, nullable = false)
    private String phone;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(columnDefinition = "user_role")
    private UserRole role = UserRole.ELDER;

    @Column(name = "trust_score")
    private Integer trustScore = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_status", columnDefinition = "verification_status")
    private VerificationStatus verificationStatus = VerificationStatus.NONE;

    @Column(name = "id_document_url")
    private String idDocumentUrl;

    @Column(name = "location_lat", precision = 10, scale = 8)
    private BigDecimal locationLat;

    @Column(name = "location_lng", precision = 11, scale = 8)
    private BigDecimal locationLng;

    private String city;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_seen_at")
    private LocalDateTime lastSeenAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public enum UserRole { ELDER, HELPER, BOTH }
    public enum VerificationStatus { NONE, PENDING, VERIFIED, REJECTED }
}
```

- [ ] **Step 2: Create UserRepository**

`backend/src/main/java/com/towin/auth/repository/UserRepository.java`:
```java
package com.towin.auth.repository;

import com.towin.common.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add User entity and repository"
```

---

### Task 5: JWT Utility

**Files:**
- Create: `backend/src/main/java/com/towin/auth/security/JwtUtil.java`
- Create: `backend/src/test/java/com/towin/auth/security/JwtUtilTest.java`

- [ ] **Step 1: Write failing test**

`backend/src/test/java/com/towin/auth/security/JwtUtilTest.java`:
```java
package com.towin.auth.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class JwtUtilTest {

    @Autowired
    private JwtUtil jwtUtil;

    @Test
    void shouldGenerateAndValidateToken() {
        String userId = UUID.randomUUID().toString();
        String token = jwtUtil.generateToken(userId, "test@email.com");

        assertThat(token).isNotBlank();
        assertThat(jwtUtil.isTokenValid(token)).isTrue();
        assertThat(jwtUtil.extractUserId(token)).isEqualTo(userId);
    }

    @Test
    void shouldReturnFalseForInvalidToken() {
        assertThat(jwtUtil.isTokenValid("invalid.token.here")).isFalse();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && mvn test -Dtest=JwtUtilTest -q
```
Expected: FAIL — JwtUtil not found.

- [ ] **Step 3: Implement JwtUtil**

`backend/src/main/java/com/towin/auth/security/JwtUtil.java`:
```java
package com.towin.auth.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String userId, String email) {
        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getKey())
                .compact();
    }

    public boolean isTokenValid(String token) {
        try {
            Jwts.parser().verifyWith(getKey()).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String extractUserId(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && mvn test -Dtest=JwtUtilTest -q
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add JWT utility with tests"
```

---

### Task 6: Auth Service + Controller

**Files:**
- Create: `backend/src/main/java/com/towin/auth/dto/RegisterRequest.java`
- Create: `backend/src/main/java/com/towin/auth/dto/LoginRequest.java`
- Create: `backend/src/main/java/com/towin/auth/dto/AuthResponse.java`
- Create: `backend/src/main/java/com/towin/auth/service/AuthService.java`
- Create: `backend/src/main/java/com/towin/auth/controller/AuthController.java`
- Create: `backend/src/test/java/com/towin/auth/service/AuthServiceTest.java`

- [ ] **Step 1: Create DTOs**

`backend/src/main/java/com/towin/auth/dto/RegisterRequest.java`:
```java
package com.towin.auth.dto;

import com.towin.common.entity.User.UserRole;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {
    @Email @NotBlank
    private String email;

    @NotBlank @Pattern(regexp = "^\\+?[0-9]{10,15}$")
    private String phone;

    @NotBlank @Size(min = 8)
    private String password;

    @NotNull
    private UserRole role;
}
```

`backend/src/main/java/com/towin/auth/dto/LoginRequest.java`:
```java
package com.towin.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @NotBlank
    private String email;

    @NotBlank
    private String password;
}
```

`backend/src/main/java/com/towin/auth/dto/AuthResponse.java`:
```java
package com.towin.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String role;
    private String userId;
}
```

- [ ] **Step 2: Write failing test**

`backend/src/test/java/com/towin/auth/service/AuthServiceTest.java`:
```java
package com.towin.auth.service;

import com.towin.auth.dto.RegisterRequest;
import com.towin.auth.repository.UserRepository;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtUtil jwtUtil;
    @InjectMocks AuthService authService;

    @Test
    void shouldThrowWhenEmailAlreadyExists() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("existing@email.com");
        req.setPhone("+1234567890");
        req.setPassword("password123");
        req.setRole(UserRole.ELDER);

        when(userRepository.existsByEmail("existing@email.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Email already registered");
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && mvn test -Dtest=AuthServiceTest -q
```
Expected: FAIL — AuthService not found.

- [ ] **Step 4: Implement AuthService**

`backend/src/main/java/com/towin/auth/service/AuthService.java`:
```java
package com.towin.auth.service;

import com.towin.auth.dto.*;
import com.towin.auth.repository.UserRepository;
import com.towin.auth.security.JwtUtil;
import com.towin.common.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("Phone already registered");
        }

        User user = User.builder()
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .build();

        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail());
        return new AuthResponse(token, user.getRole().name(), user.getId().toString());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        String token = jwtUtil.generateToken(user.getId().toString(), user.getEmail());
        return new AuthResponse(token, user.getRole().name(), user.getId().toString());
    }
}
```

- [ ] **Step 5: Create AuthController**

`backend/src/main/java/com/towin/auth/controller/AuthController.java`:
```java
package com.towin.auth.controller;

import com.towin.auth.dto.*;
import com.towin.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && mvn test -Dtest=AuthServiceTest -q
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add auth service and controller with registration and login"
```

---

### Task 7: Spring Security Configuration

**Files:**
- Create: `backend/src/main/java/com/towin/common/security/SecurityConfig.java`
- Create: `backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`
- Create: `backend/src/main/java/com/towin/common/security/UserDetailsServiceImpl.java`

- [ ] **Step 1: Create UserDetailsServiceImpl**

`backend/src/main/java/com/towin/common/security/UserDetailsServiceImpl.java`:
```java
package com.towin.common.security;

import com.towin.auth.repository.UserRepository;
import com.towin.common.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import java.util.Collections;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return new org.springframework.security.core.userdetails.User(
                user.getId().toString(),
                user.getPasswordHash(),
                Collections.emptyList()
        );
    }
}
```

- [ ] **Step 2: Create JwtAuthFilter**

`backend/src/main/java/com/towin/common/security/JwtAuthFilter.java`:
```java
package com.towin.common.security;

import com.towin.auth.security.JwtUtil;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.isTokenValid(token)) {
                String userId = jwtUtil.extractUserId(token);
                UsernamePasswordAuthenticationToken auth =
                        new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}
```

- [ ] **Step 3: Create SecurityConfig**

`backend/src/main/java/com/towin/common/security/SecurityConfig.java`:
```java
package com.towin.common.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

- [ ] **Step 4: Test auth endpoints manually**

Start backend:
```bash
cd backend && mvn spring-boot:run
```

Register a user:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","phone":"+1234567890","password":"password123","role":"ELDER"}'
```
Expected: `{"token":"...","role":"ELDER","userId":"..."}`

Login:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```
Expected: `{"token":"...","role":"ELDER","userId":"..."}`

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Spring Security with JWT filter"
```

---

## Chunk 4: Profile Backend

### Task 8: Elder Profile Entity + Service + Controller

**Files:**
- Create: `backend/src/main/java/com/towin/profile/entity/ElderProfile.java`
- Create: `backend/src/main/java/com/towin/profile/entity/HelperProfile.java`
- Create: `backend/src/main/java/com/towin/profile/repository/ElderProfileRepository.java`
- Create: `backend/src/main/java/com/towin/profile/repository/HelperProfileRepository.java`
- Create: `backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java`
- Create: `backend/src/main/java/com/towin/profile/dto/HelperProfileRequest.java`
- Create: `backend/src/main/java/com/towin/profile/dto/ProfileResponse.java`
- Create: `backend/src/main/java/com/towin/profile/service/ProfileService.java`
- Create: `backend/src/main/java/com/towin/profile/controller/ProfileController.java`
- Create: `backend/src/test/java/com/towin/profile/service/ProfileServiceTest.java`

- [ ] **Step 1: Create entities**

`backend/src/main/java/com/towin/profile/entity/ElderProfile.java`:
```java
package com.towin.profile.entity;

import com.towin.common.entity.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "elder_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ElderProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer age;

    @Column(name = "photo_url")
    private String photoUrl;

    private String bio;

    @Column(columnDefinition = "text[]")
    private String[] interests;

    @Column(columnDefinition = "text[]")
    private String[] languages;

    @Column(name = "looking_for")
    private String lookingFor = "BOTH";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
```

`backend/src/main/java/com/towin/profile/entity/HelperProfile.java`:
```java
package com.towin.profile.entity;

import com.towin.common.entity.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "helper_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HelperProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer age;

    @Column(name = "photo_url")
    private String photoUrl;

    private String bio;

    @Column(name = "skills_offered", columnDefinition = "text[]")
    private String[] skillsOffered;

    @Column(columnDefinition = "text[]")
    private String[] languages;

    @Column(name = "availability_days", columnDefinition = "text[]")
    private String[] availabilityDays;

    @Column(name = "availability_times", columnDefinition = "text[]")
    private String[] availabilityTimes;

    @Column(name = "background_check_status")
    private String backgroundCheckStatus = "NONE";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
```

- [ ] **Step 2: Create repositories**

`backend/src/main/java/com/towin/profile/repository/ElderProfileRepository.java`:
```java
package com.towin.profile.repository;

import com.towin.profile.entity.ElderProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ElderProfileRepository extends JpaRepository<ElderProfile, UUID> {
    Optional<ElderProfile> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
}
```

`backend/src/main/java/com/towin/profile/repository/HelperProfileRepository.java`:
```java
package com.towin.profile.repository;

import com.towin.profile.entity.HelperProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface HelperProfileRepository extends JpaRepository<HelperProfile, UUID> {
    Optional<HelperProfile> findByUserId(UUID userId);
    boolean existsByUserId(UUID userId);
}
```

- [ ] **Step 3: Create DTOs**

`backend/src/main/java/com/towin/profile/dto/ElderProfileRequest.java`:
```java
package com.towin.profile.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ElderProfileRequest {
    @NotBlank
    private String name;

    @NotNull @Min(50) @Max(120)
    private Integer age;

    private String bio;
    private String photoUrl;
    private String[] interests;
    private String[] languages;
    private String lookingFor = "BOTH";
}
```

`backend/src/main/java/com/towin/profile/dto/HelperProfileRequest.java`:
```java
package com.towin.profile.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class HelperProfileRequest {
    @NotBlank
    private String name;

    @NotNull @Min(18) @Max(49)
    private Integer age;

    private String bio;
    private String photoUrl;
    private String[] skillsOffered;
    private String[] languages;
    private String[] availabilityDays;
    private String[] availabilityTimes;
}
```

`backend/src/main/java/com/towin/profile/dto/ProfileResponse.java`:
```java
package com.towin.profile.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class ProfileResponse {
    private UUID userId;
    private String name;
    private Integer age;
    private String photoUrl;
    private String bio;
    private String[] interests;
    private String[] languages;
    private String role;
    private Integer trustScore;
    private String verificationStatus;
    private String city;
    // Elder-specific
    private String lookingFor;
    // Helper-specific
    private String[] skillsOffered;
    private String[] availabilityDays;
    private String[] availabilityTimes;
}
```

- [ ] **Step 4: Write failing test**

`backend/src/test/java/com/towin/profile/service/ProfileServiceTest.java`:
```java
package com.towin.profile.service;

import com.towin.auth.repository.UserRepository;
import com.towin.common.entity.User;
import com.towin.profile.dto.ElderProfileRequest;
import com.towin.profile.repository.ElderProfileRepository;
import com.towin.profile.repository.HelperProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock UserRepository userRepository;
    @Mock ElderProfileRepository elderProfileRepository;
    @Mock HelperProfileRepository helperProfileRepository;
    @InjectMocks ProfileService profileService;

    @Test
    void shouldCreateElderProfile() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).role(User.UserRole.ELDER).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(elderProfileRepository.existsByUserId(userId)).thenReturn(false);

        ElderProfileRequest request = new ElderProfileRequest();
        request.setName("John");
        request.setAge(72);

        assertThatNoException().isThrownBy(() -> profileService.createOrUpdateElderProfile(userId, request));
    }
}
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd backend && mvn test -Dtest=ProfileServiceTest -q
```
Expected: FAIL — ProfileService not found.

- [ ] **Step 6: Implement ProfileService**

`backend/src/main/java/com/towin/profile/service/ProfileService.java`:
```java
package com.towin.profile.service;

import com.towin.auth.repository.UserRepository;
import com.towin.common.entity.User;
import com.towin.profile.dto.*;
import com.towin.profile.entity.*;
import com.towin.profile.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final HelperProfileRepository helperProfileRepository;

    public ProfileResponse createOrUpdateElderProfile(UUID userId, ElderProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile profile = elderProfileRepository.findByUserId(userId)
                .orElse(ElderProfile.builder().user(user).build());

        profile.setName(request.getName());
        profile.setAge(request.getAge());
        profile.setBio(request.getBio());
        profile.setPhotoUrl(request.getPhotoUrl());
        profile.setInterests(request.getInterests());
        profile.setLanguages(request.getLanguages());
        profile.setLookingFor(request.getLookingFor());
        profile.setUpdatedAt(LocalDateTime.now());

        elderProfileRepository.save(profile);

        return buildProfileResponse(user, profile, null);
    }

    public ProfileResponse createOrUpdateHelperProfile(UUID userId, HelperProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        HelperProfile profile = helperProfileRepository.findByUserId(userId)
                .orElse(HelperProfile.builder().user(user).build());

        profile.setName(request.getName());
        profile.setAge(request.getAge());
        profile.setBio(request.getBio());
        profile.setPhotoUrl(request.getPhotoUrl());
        profile.setSkillsOffered(request.getSkillsOffered());
        profile.setLanguages(request.getLanguages());
        profile.setAvailabilityDays(request.getAvailabilityDays());
        profile.setAvailabilityTimes(request.getAvailabilityTimes());
        profile.setUpdatedAt(LocalDateTime.now());

        helperProfileRepository.save(profile);

        return buildProfileResponse(user, null, profile);
    }

    public ProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ElderProfile elder = elderProfileRepository.findByUserId(userId).orElse(null);
        HelperProfile helper = helperProfileRepository.findByUserId(userId).orElse(null);

        return buildProfileResponse(user, elder, helper);
    }

    private ProfileResponse buildProfileResponse(User user, ElderProfile elder, HelperProfile helper) {
        ProfileResponse.ProfileResponseBuilder builder = ProfileResponse.builder()
                .userId(user.getId())
                .role(user.getRole().name())
                .trustScore(user.getTrustScore())
                .verificationStatus(user.getVerificationStatus().name())
                .city(user.getCity());

        if (elder != null) {
            builder.name(elder.getName())
                    .age(elder.getAge())
                    .photoUrl(elder.getPhotoUrl())
                    .bio(elder.getBio())
                    .interests(elder.getInterests())
                    .languages(elder.getLanguages())
                    .lookingFor(elder.getLookingFor());
        } else if (helper != null) {
            builder.name(helper.getName())
                    .age(helper.getAge())
                    .photoUrl(helper.getPhotoUrl())
                    .bio(helper.getBio())
                    .languages(helper.getLanguages())
                    .skillsOffered(helper.getSkillsOffered())
                    .availabilityDays(helper.getAvailabilityDays())
                    .availabilityTimes(helper.getAvailabilityTimes());
        }

        return builder.build();
    }
}
```

- [ ] **Step 7: Create ProfileController**

`backend/src/main/java/com/towin/profile/controller/ProfileController.java`:
```java
package com.towin.profile.controller;

import com.towin.profile.dto.*;
import com.towin.profile.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping("/me")
    public ResponseEntity<ProfileResponse> getMyProfile(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.getProfile(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProfileResponse> getProfile(@PathVariable UUID id) {
        return ResponseEntity.ok(profileService.getProfile(id));
    }

    @PutMapping("/elder")
    public ResponseEntity<ProfileResponse> updateElderProfile(
            Authentication auth,
            @Valid @RequestBody ElderProfileRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.createOrUpdateElderProfile(userId, request));
    }

    @PutMapping("/helper")
    public ResponseEntity<ProfileResponse> updateHelperProfile(
            Authentication auth,
            @Valid @RequestBody HelperProfileRequest request) {
        UUID userId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(profileService.createOrUpdateHelperProfile(userId, request));
    }
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd backend && mvn test -Dtest=ProfileServiceTest -q
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add elder and helper profile management"
```

---

## Chunk 5: React Auth Frontend

### Task 9: Auth Pages (Register + Login)

**Files:**
- Create: `frontend/src/pages/Register.jsx`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Create AuthContext**

`frontend/src/context/AuthContext.jsx`:
```jsx
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const userId = localStorage.getItem('userId');
    return token ? { token, role, userId } : null;
  });

  const login = (token, role, userId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('userId', userId);
    setUser({ token, role, userId });
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 2: Create Register page**

`frontend/src/pages/Register.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', phone: '', password: '', role: 'ELDER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, data.role, data.userId);
      navigate('/profile/setup');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-700">Join ToWin</h1>

        {error && <p className="text-red-600 text-lg mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xl font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border-2 border-gray-300 rounded-lg p-3 text-xl"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-xl font-medium mb-1">Phone Number</label>
            <input
              type="tel"
              className="w-full border-2 border-gray-300 rounded-lg p-3 text-xl"
              value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-xl font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full border-2 border-gray-300 rounded-lg p-3 text-xl"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-xl font-medium mb-2">I am joining as:</label>
            <div className="grid grid-cols-3 gap-2">
              {['ELDER', 'HELPER', 'BOTH'].map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm({...form, role})}
                  className={`p-3 rounded-lg border-2 text-lg font-medium transition-colors
                    ${form.role === role
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:border-blue-400'}`}
                >
                  {role === 'ELDER' ? 'Elder' : role === 'HELPER' ? 'Helper' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white text-xl py-4 rounded-lg font-bold
                       hover:bg-blue-700 disabled:opacity-50 mt-4"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-lg mt-4">
          Already have an account? <Link to="/login" className="text-blue-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Login page**

`frontend/src/pages/Login.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.role, data.userId);
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-700">Welcome Back</h1>

        {error && <p className="text-red-600 text-lg mb-4 text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xl font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border-2 border-gray-300 rounded-lg p-3 text-xl"
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-xl font-medium mb-1">Password</label>
            <input
              type="password"
              className="w-full border-2 border-gray-300 rounded-lg p-3 text-xl"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white text-xl py-4 rounded-lg font-bold
                       hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-lg mt-4">
          New here? <Link to="/register" className="text-blue-600 font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire up App.jsx with routing**

`frontend/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Register from './pages/Register';
import Login from './pages/Login';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <div className="text-3xl p-8">Dashboard — coming in next plan</div>
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/register" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

- [ ] **Step 5: Test full auth flow manually**

Start both servers:
```bash
# Terminal 1
cd backend && mvn spring-boot:run

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173:
1. Click "Create Account", fill form, submit
2. Should redirect to /profile/setup (shows 404 — that's OK for now)
3. Go to /login, fill in same credentials
4. Should redirect to /dashboard
5. Check browser localStorage — token, role, userId should be set

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add React auth pages with registration and login"
```

---

## Chunk 6: Global Error Handling

### Task 10: Global Exception Handler

**Files:**
- Create: `backend/src/main/java/com/towin/common/exception/GlobalExceptionHandler.java`
- Create: `backend/src/main/java/com/towin/common/dto/ErrorResponse.java`

- [ ] **Step 1: Create ErrorResponse DTO**

`backend/src/main/java/com/towin/common/dto/ErrorResponse.java`:
```java
package com.towin.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ErrorResponse {
    private String message;
    private int status;
    private LocalDateTime timestamp;
}
```

- [ ] **Step 2: Create GlobalExceptionHandler**

`backend/src/main/java/com/towin/common/exception/GlobalExceptionHandler.java`:
```java
package com.towin.common.exception;

import com.towin.common.dto.ErrorResponse;
import org.springframework.http.*;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(ex.getMessage(), 400, LocalDateTime.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(message, 400, LocalDateTime.now()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Something went wrong. Please try again.", 500, LocalDateTime.now()));
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add global exception handler"
```

---

## Plan 1 Complete

**What was built:**
- Spring Boot backend with JWT auth
- PostgreSQL schema (Flyway migrations)
- Elder + Helper profile management
- React frontend with registration + login
- Global error handling

**Next:** Plan 2 — Trust Progression Engine + Messaging
