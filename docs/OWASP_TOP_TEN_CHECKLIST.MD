## OWASP Top 10 Checklist

### A01:2021 – Broken Access Control

 - Violation of the principle of the least privilege or deny by default, where access should only be granted for particular capabilities, roles, or users, but is available to anyone.
   - Backk microservice denies service function access by default and requires proper authorization annotation to be present for each service function, otherwise an exception is thrown
   - Backk microservice denies entity property access by default and requires a proper access control annotation to be present for each property, otherwise an exception is thrown

 - Bypassing access control checks by modifying the URL (parameter tampering or force browsing), internal application state, or the HTML page, or by using an attack tool modifying API requests.
   - Backk microservice access control checks cannot be bypassed, Backk will always check authorization based the presence and validity of JWT in HTTP or Kafka Authorization header. Authorization info is present and checked in incoming Redis message also

 - Permitting viewing or editing someone else's account, by providing its unique identifier (insecure direct object references)
   - In Backk microservice this is not possible, if service function is properly annotated with `@AllowForEveryUserForOwnResources()` decorator. 
   - Backk will also double-check that if the service function argument contain user id if `@AllowForEveryUser` is actually wrong and `@AllowForEveryUserForOwnResources()` should be used instead.

 - Accessing API with missing access controls for POST, PUT and DELETE
   - Backk microservice does not differentiate access control handling based on used HTTP method. It handles access control in similar fashion regardless of HTTP method

 - Elevation of privilege. Acting as a user without being logged in or acting as an admin when logged in as a user.
   - This is not in scope of a Backk microservice. Logging of user is and should be handled by a 3rd party IAM solution (for example Keycloak) which is tested and secured against this kind of problems.

 - Metadata manipulation, such as replaying or tampering with a JSON Web Token (JWT) access control token, or a cookie or hidden field manipulated to elevate privileges or abusing JWT invalidation.
   - Replaying of JWT is not possible, because all traffic between external client and Backk microservice and between Backk microservices is protected by TLS. TLS protection is handled in Kubernetes cluster by API Gateway for external traffic and by a service mesh for mTLS between Backk microservices
   - JWT cannot be manipulated because it is signed, JWT expiration is also checked by Backk microservice access control. Expired JTWs are not accepted as valid JWTs by a Backk microservice.
   - **NOTE! Web Clients that want to store JWTs to the session storage in the web browser MUST ENCRYPT the JWT, otherwise installed malicious 3rd party JavaScript libraries can read session storage and abuse the JWT**
   
 - CORS misconfiguration allows API access from unauthorized/untrusted origins
   - This should not be applicable because all backends and APIs should be accessed through the Kubernetes Ingress and API Gateway. All backends and APIs shall then have the same FQDN of the Kubernetes cluster edge nodes.
   
### A02:2021 – Cryptographic Failures

 - Is any data transmitted in clear text? This concerns protocols such as HTTP, SMTP, FTP also using TLS upgrades like STARTTLS. External internet traffic is hazardous. Verify all internal traffic, e.g., between load balancers, web servers, or back-end systems.
   - Your platform in Kubernetes should implement TLS both internally inside the cluster using a service mesh and TLS termination for external clients in the API Gateway

 - Are default crypto keys in use, weak crypto keys generated or re-used, or is proper key management or rotation missing? Are crypto keys checked into source code repositories
   - In Production environment, encryption key for Backk microservice must pass length and strength checks

 - Is encryption not enforced, e.g., are any HTTP headers (browser) security directives or headers missing?
   - Each Backk microservice request response has Strict Transport Security header set with max-age to max integer value

 - Is the received server certificate and the trust chain properly validated
   - 

 - Are initialization vectors ignored, reused, or not generated sufficiently secure for the cryptographic mode of operation? Is an insecure mode of operation such as ECB in use? Is encryption used when authenticated encryption is more appropriate?
   - By default, and when possible, Backk uses a randomly generated initialization vector for encryption of data: `randomBytes(16)`
   - ECB is not used, Backk microservice's encryption algorithm is AES-256-CBC

 - Are passwords being used as cryptographic keys in absence of a password base key derivation function?
   - No, in production environment Backk microservice's encryption key is checked for appropriate length and strength

 - Is randomness used for cryptographic purposes that was not designed to meet cryptographic requirements? Even if the correct function is chosen, does it need to be seeded by the developer, and if not, has the developer over-written the strong seeding functionality built into it with a seed that lacks sufficient entropy/unpredictability?
   - No

 - Are deprecated hash functions such as MD5 or SHA1 in use, or are non-cryptographic hash functions used when cryptographic hash functions are needed?
   - MD5 or SHA1 is not used, Argon2 is used for hashing passwords
 
 - Are deprecated cryptographic padding methods such as PCKS number 1 v1.5 in use?
   - No

 - Are cryptographic error messages or side channel information exploitable, for example in the form of padding oracle attacks?
   - Not known

### A03:2021 – Injection

 - User-supplied data is not validated, filtered, or sanitized by the application
   - Backk validates all input data (service function arguments) using mandatory validation annotations
   
 - Dynamic queries or non-parameterized calls without context-aware escaping are used directly in the interpreter
   - Backk uses ORM and SQL prepared statements to implement queries

 - Hostile data is used within object-relational mapping (ORM) search parameters to extract additional, sensitive records
   - Backk microservice does not allow user defined (= client originated) dynamic queries to query any non-readable entity fields

 - Hostile data is directly used or concatenated. The SQL or command contains the structure and malicious data in dynamic queries, commands, or stored procedures.
   - Backk microservice will always check the service function response object or the first object in the object array that it matches the validations and property types of the specific class. In this way, it is not easy for malicious data in queries to result in sensitive data exposed in query response.
 

### A04:2021 – Insecure Design

 - Establish and use a secure development lifecycle with AppSec professionals to help evaluate and design security and privacy-related controls

 - Establish and use a library of secure design patterns or paved road ready to use components

 - Use threat modeling for critical authentication, access control, business logic, and key flows

 - Integrate security language and controls into user stories

 - Integrate plausibility checks at each tier of your application (from frontend to backend)

 - Write unit and integration tests to validate that all critical flows are resistant to the threat model. Compile use-cases and misuse-cases for each tier of your application.

 - Segregate tier layers on the system and network layers depending on the exposure and protection needs
   - Use Kubernetes namespaces and Network Policies between them. Implement authorization between services with a service mesh

 - Segregate tenants robustly by design throughout all tiers

 - Limit resource consumption by user or service
   - Backk microservice defines default request rate limiting for services exposed to external clients (in case of using Ambassador Edge Stack)
   - Each Backk microservice has limits set on CPU and memory usage by default

### A05:2021 – Security Misconfiguration
 
 - Missing appropriate security hardening across any part of the application stack or improperly configured permissions on cloud services.
   - Backk microservice runs in a distro-less non-privileged container with non-root user. Privilege escalation is not allowed and all linux capabilities are dropped by default. Container has read-only filesystem.

 - Unnecessary features are enabled or installed (e.g., unnecessary ports, services, pages, accounts, or privileges)
   - Backk microservice runs in a distro-less non-privileged container with non-root user. Privilege escalation is not allowed and all linux capabilities are dropped by default. Container has read-only filesystem.

 - Default accounts and their passwords are still enabled and unchanged.
   - Backk microservice database user passwords have length and strength checks in production environment

 - Error handling reveals stack traces or other overly informative error messages to users.
   - In production environment, Backk microservices never send stack traces to clients.

 - For upgraded systems, the latest security features are disabled or not configured securely.

 - The security settings in the application servers, application frameworks (e.g., Struts, Spring, ASP.NET), libraries, databases, etc., are not set to secure values.
   - Databases are secured with password and mTLS by service mesh. Redis cache is secured by authentication in production.

 - The server does not send security headers or directives, or they are not set to secure values.
   - Backk microservice sends following HTTP response headers:
     - X-Content-Type-Options: nosniff
     - Strict-Transport-Security: max-age: <max-integer-value>; includeSubDomains
     - X-Frame-Options: DENY
     - Content-Security-Policy: frame-ancestors 'none'
     - Content-Type: application/json
     - If caching is not specifically enabled and configured, following header is set: Cache-Control: no-store
     - Access-Control-Allow-Origin: https://<api-gateway-fqdn>
     
 - The software is out of date or vulnerable (see A06:2021-Vulnerable and Outdated Components).
   - It is recommended to have a Continuous Vulnerability Scan pipeline as part of DevSecOps, where each latest microservice container is scanned for possible vulnerabilities at regular intervals (e.g. every night)
   
   
### A06:2021 – Vulnerable and Outdated Components

- If you do not know the versions of all components you use (both client-side and server-side). This includes components you directly use as well as nested dependencies.

- If the software is vulnerable, unsupported, or out of date. This includes the OS, web/application server, database management system (DBMS), applications, APIs and all components, runtime environments, and libraries.

- If you do not scan for vulnerabilities regularly and subscribe to security bulletins related to the components you use.

- If you do not fix or upgrade the underlying platform, frameworks, and dependencies in a risk-based, timely fashion. This commonly happens in environments when patching is a monthly or quarterly task under change control, leaving organizations open to days or months of unnecessary exposure to fixed vulnerabilities.

- If software developers do not test the compatibility of updated, upgraded, or patched libraries.

- If you do not secure the components’ configurations (see A05:2021-Security Misconfiguration).

For all above:  It is recommended to have a Continuous Vulnerability Scan pipeline as part of DevSecOps, where each latest microservice container is scanned for possible vulnerabilities at regular intervals (e.g. every night).
Found "Critical" and "High" level vulnerabilities should trigger a pipeline failure.

### A07:2021 – Identification and Authentication Failures

- Permits automated attacks such as credential stuffing, where the attacker has a list of valid usernames and passwords.
  - Ensure that you can deny this with your selected IAM service (e.g. Keycloak) 
  
- Permits brute force or other automated attacks.
  - Ensure that you can deny this with your selected IAM service (e.g. Keycloak) 
  - You need to configure temporary account locking to happen after several consecutive failed login attempts

- Permits default, weak, or well-known passwords, such as "Password1" or "admin/admin"
  - Configure required password complexity policy in your IAM service (e.g. Keycloak) 

- Uses weak or ineffective credential recovery and forgot-password processes, such as "knowledge-based answers," which cannot be made safe.
  - Ensure that this is not allowed in your IAM service (e.g. Keycloak)

- Uses plain text, encrypted, or weakly hashed passwords data stores.
  - Keycloak IAM uses secure hashing algorithm and you can even provide your own algorithm if needed

- Has missing or ineffective multi-factor authentication.
  - Keycloak IAM can be configured to require multi-factor authentication.

- Exposes session identifier in the URL.
  - No, Keycloak uses cookie

- Reuse session identifier after successful login.
  - No

- Does not correctly invalidate Session IDs. User sessions or authentication tokens (mainly single sign-on (SSO) tokens) aren't properly invalidated during logout or a period of inactivity.
  - Keycloak support single logout (SLO)

### A08:2021 – Software and Data Integrity Failures

- Use digital signatures or similar mechanisms to verify the software or data is from the expected source and has not been altered.
  - Backk microservice helm charts defines the container image tags with both version and digest (SHA256)

- Ensure libraries and dependencies, such as npm or Maven, are consuming trusted repositories. If you have a higher risk profile, consider hosting an internal known-good repository that's vetted.

- Ensure that a software supply chain security tool, such as OWASP Dependency Check or OWASP CycloneDX, is used to verify that components do not contain known vulnerabilities
  - It is recommended to have a Continuous Vulnerability Scan pipeline as part of DevSecOps, where each latest microservice container is scanned for possible vulnerabilities at regular intervals (e.g. every night)

- Ensure that there is a review process for code and configuration changes to minimize the chance that malicious code or configuration could be introduced into your software pipeline.
  - Rely on your source code repository tools, like GitLab Merge request or GitHub pull request for committing to the main branch.
  - You should require that at least two independent reviews by two independent reviewers are done for each merge/pull request
  - Consider hiring a security expert in your product unit who will review software and configuration changes from only security point of view.
  - Never allow the user himself/herself to approve his/hers own merge/pull request

- Ensure that your CI/CD pipeline has proper segregation, configuration, and access control to ensure the integrity of the code flowing through the build and deploy processes.
  - Microservice CI pipeline is included inside the microservice's Git repository and reviewers need to check for merge/pull requests that inappropriate changes are not made to the microservice CI pipeline.
  - Staging CD pipeline should be secured in own Git repository where only authorized personnel can trigger production changes
  - Production CD pipeline should be secured in own Git repository where only authorized personnel can trigger production changes
  - Production GitOps repo should be secured so that only authorized personnel can access that repo.

- Ensure that unsigned or unencrypted serialized data is not sent to untrusted clients without some form of integrity check or digital signature to detect tampering or replay of the serialized data

### A09:2021 – Security Logging and Monitoring Failures

- Auditable events, such as logins, failed logins, and high-value transactions, are not logged.
  - Ensure that needed events are properly logged by your IAM service (e.g. Keycloak)
  - Backk microservice should define AuditLogService implementation to enable audit logging.
  - Backk microservice audit logs events related to service function calls for a service that extends `UserAccountBaseService`
  - Backk microservice can audit log service function calls by annotating service function with `@AuditLog()` decorator.

- Warnings and errors generate no, inadequate, or unclear log messages.
  - Backk generates a log entry for all errors that are not client errors

- Logs of applications and APIs are not monitored for suspicious activity.

- Logs are only stored locally.
  - Your platform should store microservice logs to Elasticsearch in Kubernetes cluster.

- Appropriate alerting thresholds and response escalation processes are not in place or effective.
  - System admins should create proper alerting using Prometheus AlertManager and forward alerts to an appropriate system like PagerDuty

- Penetration testing and scans by dynamic application security testing (DAST) tools (such as OWASP ZAP) do not trigger alerts.
  - OWASP ZAP API scan should be done as part of Backk microservice CI pipeline.

- The application cannot detect, escalate, or alert for active attacks in real-time or near real-time.
  - System admins should create proper alerting using Prometheus AlertManager and forward alerts to an appropriate system like PagerDuty

### A10:2021 – Server-Side Request Forgery (SSRF)

- SSRF flaws occur whenever a web application is fetching a remote resource without validating the user-supplied URL
  - Enforce proper policies for Kubernetes cluster service mesh egress
  - Enforce that when Backk microservice receives URL in input that is used for server side fetch, it must be validated against allowed URLs list.
