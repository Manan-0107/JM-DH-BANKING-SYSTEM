# JM-DH Banking System — Comprehensive Normalization Report: 1NF through 5NF

**Course Level**: Advanced Database Management Systems (DBMS)  
**Target RDBMS**: MySQL 8.0+ / Relational Query Calculus  
**Focus**: Functional Dependencies, Minimal Cover, Attribute Closures, Decomposition Proofs, Lossless-Join & Dependency Preservation  

---

## 1. Mathematical Foundations & Formal Definitions

### 1.1 Functional Dependency (FD)
Given relation schema $R(A_1, A_2, \dots, A_n)$ and subsets $X, Y \subseteq R$, a functional dependency $X \to Y$ asserts that for every valid legal relational instance $r(R)$:
$$\forall t_1, t_2 \in r, \quad t_1[X] = t_2[X] \implies t_1[Y] = t_2[Y]$$

### 1.2 Attribute Closure ($X^+$)
The attribute closure of an attribute set $X$ with respect to a set of functional dependencies $F$, denoted $X^+_F$, is the set of all attributes functionally determined by $X$:
$$X^+ = \{ A \in R \mid F \models X \to A \}$$

### 1.3 Candidate Key, Superkey & Prime Attributes
- **Superkey ($K$)**: A set of attributes $K \subseteq R$ such that $K^+ = R$.
- **Candidate Key ($CK$)**: A minimal superkey; that is, $K^+ = R$ and $\forall A \in K, (K \setminus \{A\})^+ \neq R$.
- **Prime Attribute**: Any attribute $A$ that is a member of *at least one* candidate key.
- **Non-Prime Attribute**: An attribute that does not appear in any candidate key.

---

## 2. Normalization Analysis of the Core Production Schema

Let us analyze the unnormalized legacy banking schema and trace its rigorous mathematical decomposition into Boyce-Codd Normal Form (BCNF).

### 2.1 The Unnormalized Universal Banking Relation ($R_{\text{universal}}$)

Consider an unnormalized universal relation capturing customer accounts, branches, and transaction activity:

$$R_{\text{universal}}(\text{cust\_id}, \text{cust\_name}, \text{email}, \text{phone}, \text{acc\_no}, \text{acc\_type}, \text{balance}, \text{ifsc}, \text{branch\_name}, \text{branch\_city}, \text{txn\_id}, \text{txn\_amount}, \text{txn\_date})$$

#### Functional Dependencies ($F$):
1. $f_1: \text{cust\_id} \to \{\text{cust\_name}, \text{email}, \text{phone}\}$
2. $f_2: \text{email} \to \{\text{cust\_id}, \text{cust\_name}, \text{phone}\}$
3. $f_3: \text{acc\_no} \to \{\text{cust\_id}, \text{acc\_type}, \text{balance}, \text{ifsc}\}$
4. $f_4: \text{ifsc} \to \{\text{branch\_name}, \text{branch\_city}\}$
5. $f_5: \text{txn\_id} \to \{\text{acc\_no}, \text{txn\_amount}, \text{txn\_date}\}$

#### Candidate Key Determination for $R_{\text{universal}}$:
- Look at the right-hand sides: $\text{txn\_id}$ never appears on the right of any FD. Thus, $\text{txn\_id}$ must be in every candidate key.
- Compute closure of $\{\text{txn\_id}\}$:
  $$\{\text{txn\_id}\}^+ = \{\text{txn\_id}, \text{acc\_no}, \text{txn\_amount}, \text{txn\_date}\}$$
  Applying $f_3$: adds $\{\text{cust\_id}, \text{acc\_type}, \text{balance}, \text{ifsc}\}$.
  Applying $f_1$: adds $\{\text{cust\_name}, \text{email}, \text{phone}\}$.
  Applying $f_4$: adds $\{\text{branch\_name}, \text{branch\_city}\}$.
  $$\{\text{txn\_id}\}^+ = R_{\text{universal}}$$
- Therefore, the unique Candidate Key of $R_{\text{universal}}$ is:
  $$CK = \{\text{txn\_id}\}$$
- Prime attributes: $\{\text{txn\_id}\}$
- Non-prime attributes: All remaining 12 attributes.

---

### 2.2 First Normal Form (1NF)

#### Definition:
A relation $R$ is in 1NF if and only if all attribute domains contain only **atomic (indivisible) values**, and there are no repeating groups or composite multivalued columns.

#### Violations in Legacy Prototype:
1. In unnormalized forms, `phone` or `address` stored multiple comma-separated contacts (e.g., `"+91 98200 12345, +91 98200 54321"`).
2. KYC records contained repeating arrays of uploaded documents embedded within single customer rows.

#### Resolution to 1NF:
Every attribute is constrained to a scalar datatype (`VARCHAR`, `INT`, `DECIMAL`, `DATE`). Repeating groups such as `kyc_verifications` and `beneficiaries` are split into separate relation rows linked by `customer_id`.

---

### 2.3 Second Normal Form (2NF)

#### Definition:
A relation $R$ is in 2NF if and only if it is in 1NF and **no non-prime attribute is partially dependent on any proper subset of any candidate key**.
$$\forall X \to A \in F, \text{ where } A \notin CK, \quad \nexists K \subset CK \text{ such that } K \to A$$
*(Note: If every candidate key is a single attribute, the relation is automatically in 2NF).*

#### Analysis:
In a composite junction table, such as an unnormalized Account-Ownership table:
$$R_{\text{joint}}(\underline{\text{acc\_no}, \text{cust\_id}}, \text{ownership\_type}, \text{cust\_name}, \text{acc\_balance})$$
- Candidate Key: $\{\text{acc\_no}, \text{cust\_id}\}$
- Dependencies:
  - $\{\text{acc\_no}, \text{cust\_id}\} \to \text{ownership\_type}$ (Full dependency)
  - $\text{cust\_id} \to \text{cust\_name}$ (**Partial dependency!** $\text{cust\_id} \subset CK$)
  - $\text{acc\_no} \to \text{acc\_balance}$ (**Partial dependency!** $\text{acc\_no} \subset CK$)

#### Resolution to 2NF:
Decompose $R_{\text{joint}}$ into:
1. $R_{\text{cust}}(\underline{\text{cust\_id}}, \text{cust\_name})$
2. $R_{\text{acc}}(\underline{\text{acc\_no}}, \text{acc\_balance})$
3. $R_{\text{ownership}}(\underline{\text{acc\_no}, \text{cust\_id}}, \text{ownership\_type})$

---

### 2.4 Third Normal Form (3NF)

#### Definition:
A relation $R$ is in 3NF if and only if it is in 2NF and for every non-trivial functional dependency $X \to Y \in F$:
1. $X$ is a **superkey** of $R$, OR
2. Each attribute $A \in Y \setminus X$ is a **prime attribute** (member of a candidate key).

#### Transitive Dependency Violation in $R_{\text{accounts\_branch}}$:
Consider:
$$R_{\text{acc\_br}}(\underline{\text{acc\_no}}, \text{customer\_id}, \text{balance}, \text{ifsc\_code}, \text{branch\_name}, \text{branch\_city})$$
- Candidate Key: $\{\text{acc\_no}\}$
- Dependencies:
  - $\text{acc\_no} \to \{\text{customer\_id}, \text{balance}, \text{ifsc\_code}\}$ ($X$ is a superkey — valid in 3NF)
  - $\text{ifsc\_code} \to \{\text{branch\_name}, \text{branch\_city}\}$ ($X$ is **NOT** a superkey, and $\{\text{branch\_name}, \text{branch\_city}\}$ are **NOT** prime attributes!)
- This represents a prohibited **transitive dependency**:
  $$\text{acc\_no} \to \text{ifsc\_code} \to \{\text{branch\_name}, \text{branch\_city}\}$$

#### Consequences of 3NF Violation:
- **Insert Anomaly**: A new branch cannot be added to the database until an account is opened at that branch.
- **Delete Anomaly**: If the last account at a branch is closed, all branch address information is lost.
- **Update Anomaly**: If a branch changes its address, every account record at that branch must be modified.

#### 3NF Decomposition:
Decompose into two relations:
1. $\text{accounts}(\underline{\text{account\_number}}, \text{customer\_id}, \text{account\_type}, \text{balance}, \text{ifsc\_code})$
2. $\text{branches}(\underline{\text{ifsc\_code}}, \text{branch\_id}, \text{branch\_name}, \text{city}, \text{address}, \text{timing}, \text{phone})$

Both decomposed relations satisfy the 3NF condition.

---

### 2.5 Boyce-Codd Normal Form (BCNF)

#### Definition:
A relation $R$ is in BCNF if and only if for every non-trivial functional dependency $X \to Y \in F$, **$X$ is a superkey of $R$**.
*(BCNF eliminates the exception granted in 3NF for prime attributes on the right-hand side).*

#### Classic BCNF Case Study in Banking:
Consider an account assignment relation where multiple bank advisors serve branches, but each advisor operates at only one branch:
$$R_{\text{advisory}}(\underline{\text{customer\_id}, \text{service\_type}}, \text{advisor\_id}, \text{branch\_name})$$
Dependencies:
1. $\{\text{customer\_id}, \text{service\_type}\} \to \text{advisor\_id}$
2. $\{\text{customer\_id}, \text{service\_type}\} \to \text{branch\_name}$
3. $\text{advisor\_id} \to \text{branch\_name}$

- Candidate Keys:
  - $CK_1 = \{\text{customer\_id}, \text{service\_type}\}$
  - $CK_2 = \{\text{customer\_id}, \text{advisor\_id}\}$
- Prime attributes: $\{\text{customer\_id}, \text{service\_type}, \text{advisor\_id}\}$
- Analysis under 3NF:
  - For $\text{advisor\_id} \to \text{branch\_name}$, $\text{advisor\_id}$ is not a superkey, and $\text{branch\_name}$ is non-prime. This violates 3NF!
  - If we modified the rule so $\text{branch\_name}$ was part of a key, 3NF would permit it, but BCNF strictly forbids it because the determinant $\text{advisor\_id}$ is not a superkey.

#### BCNF Decomposition Algorithm:
For any non-trivial $X \to Y$ where $X$ is not a superkey:
1. Decompose $R$ into $R_1(X \cup Y)$ and $R_2(R \setminus Y)$.
2. Compute the projections of functional dependencies $F_{R_1}$ and $F_{R_2}$.
3. Verify that the decomposition is a **lossless join**:
   $$R_1 \cap R_2 = X \implies X \to R_1 \text{ or } X \to R_2$$
   Since $X \to Y$, $X \to R_1$ is guaranteed, making the decomposition **strictly lossless**.

---

## 3. Fourth Normal Form (4NF) & Multivalued Dependencies (MVD)

### 3.1 Formal Definition of Multivalued Dependency (MVD)
Let $R$ be a relational schema, and $X, Y \subseteq R$. The multivalued dependency $X \twoheadrightarrow Y$ ($X$ multidetermines $Y$) holds on $R$ if, whenever tuples $t_1, t_2 \in r(R)$ satisfy $t_1[X] = t_2[X]$, there exist tuples $t_3, t_4 \in r(R)$ such that:
$$t_3[X] = t_4[X] = t_1[X]$$
$$t_3[Y] = t_1[Y] \quad \text{and} \quad t_3[R \setminus (X \cup Y)] = t_2[R \setminus (X \cup Y)]$$
$$t_4[Y] = t_2[Y] \quad \text{and} \quad t_4[R \setminus (X \cup Y)] = t_1[R \setminus (X \cup Y)]$$

In plain English: $Y$ is independent of the remaining attributes $R \setminus (X \cup Y)$, given $X$.

### 3.2 Academic 4NF Demonstration (Independent Customer Profiles)

In our production schema, customers register multiple independent contact numbers and hold multiple independent credit card privileges.
Consider an unnormalized relation:

$$R_{\text{cust\_info}}(\text{customer\_id}, \text{phone\_number}, \text{privilege\_club})$$

Where a customer's phone numbers are completely independent of their enrolled privilege clubs.

#### Relational Data Instance:
| customer_id | phone_number | privilege_club |
| :--- | :--- | :--- |
| CUST-101 | +91 98200 12345 | Airport Lounge Access |
| CUST-101 | +91 98200 12345 | Golf Club Privilege |
| CUST-101 | +91 98200 54321 | Airport Lounge Access |
| CUST-101 | +91 98200 54321 | Golf Club Privilege |

#### Analysis:
- There are no non-trivial functional dependencies ($F = \emptyset$).
- Every attribute is prime; the entire relation is the candidate key $\{\text{customer\_id}, \text{phone\_number}, \text{privilege\_club}\}$.
- Consequently, $R_{\text{cust\_info}}$ is in **BCNF**!
- However, the following MVDs hold:
  $$\text{customer\_id} \twoheadrightarrow \text{phone\_number}$$
  $$\text{customer\_id} \twoheadrightarrow \text{privilege\_club}$$
- Because the determinant $\text{customer\_id}$ is **not a superkey**, this relation violates **4NF**! It forces a Cartesian cross-product of phones $\times$ clubs, causing massive tuple redundancy.

#### 4NF Decomposition (Fagin's Theorem):
Decompose $R_{\text{cust\_info}}$ into:
1. $R_{\text{phones}}(\underline{\text{customer\_id}, \text{phone\_number}})$
2. $R_{\text{privileges}}(\underline{\text{customer\_id}, \text{privilege\_club}})$

Both resulting relations are in 4NF.

---

## 4. Fifth Normal Form (5NF) & Join Dependencies (JD)

### 4.1 Formal Definition of Join Dependency (JD)
A relation $R$ satisfies the join dependency $\Join [R_1, R_2, \dots, R_m]$ if and only if for every legal instance $r(R)$:
$$r = \pi_{R_1}(r) \bowtie \pi_{R_2}(r) \bowtie \dots \bowtie \pi_{R_m}(r)$$

A relation is in **5NF (Project-Join Normal Form / PJNF)** if and only if every non-trivial join dependency $\Join [R_1, R_2, \dots, R_m]$ in $R$ is implied by the candidate keys of $R$.

### 4.2 Academic 5NF Demonstration (Syndicated Corporate Lending)

Consider syndicated corporate loans where:
- A corporate borrower negotiates with multiple lending banks.
- Each lending bank provides specific loan products (e.g., Working Capital, Equipment Lease).
- A loan product is sanctioned to a borrower only if a specific tri-partite underwriting agreement binds that specific borrower, bank, and product together:

$$R_{\text{syndicate}}(\text{borrower\_cin}, \text{lending\_bank}, \text{loan\_product})$$

If the business rule dictates that whenever:
1. Bank $B$ offers Product $P$,
2. Borrower $C$ borrows from Bank $B$, and
3. Borrower $C$ is approved for Product $P$,
Then Borrower $C$ must obtain Product $P$ through Bank $B$.

This constraint cannot be expressed using pairwise MVDs (4NF), but represents a ternary cyclic **Join Dependency**:
$$\Join [(\text{borrower\_cin}, \text{lending\_bank}), (\text{lending\_bank}, \text{loan\_product}), (\text{borrower\_cin}, \text{loan\_product})]$$

#### 5NF Decomposition:
Decompose into three binary projection tables:
1. $R_1(\underline{\text{borrower\_cin}, \text{lending\_bank}})$
2. $R_2(\underline{\text{lending\_bank}, \text{loan\_product}})$
3. $R_3(\underline{\text{borrower\_cin}, \text{loan\_product}})$

Joining any two creates spurious tuples; joining all three reconstitutes the original legal relation losslessly without redundancy.

---

## 5. Normalization vs. Performance Trade-Off Analysis

| Normal Form | Primary Anomaly Prevented | Relational Join Overhead | Write Performance | Recommended Banking Application |
| :--- | :--- | :--- | :--- | :--- |
| **1NF** | Repeating collections, unparseable data | Zero | High | Mandatory for all database schemas. |
| **2NF** | Partial key redundancy | Very Low | High | Core transactional and junction tables. |
| **3NF** | Transitive non-key updates | Low (1 Join) | Optimal | **Authoritative Standard** for OLTP accounts and customers. |
| **BCNF** | Key-determinant update anomalies | Moderate | High | Specialized advisory and authorization tables. |
| **4NF** | Cartesian cross-product explosion | Moderate | High | Multi-contact and multi-privilege profiles. |
| **5NF** | Complex cyclic join redundancies | High (3-way Join) | Lower | Specialized multi-party syndicate agreements. |

### Justification for Strategic Denormalization in Reporting:
In our database views (`v_customer_portfolio`, `v_active_deposits_summary`) and materialized summary tables (`mv_daily_branch_metrics`), we intentionally pre-join normalized relations to achieve sub-millisecond analytical query response times while keeping the underlying OLTP tables strictly in 3NF/BCNF.
