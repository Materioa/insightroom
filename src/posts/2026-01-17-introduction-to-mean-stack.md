---
title: Introduction to MEAN Stack
layout: post
date: '2026-01-17 12:25:45'
image: "/assets/img/covers/d146a58e-d51d-46d1-9ccb-e3c9a0a977ed.webp"
excerpt: This resource provides overview about 
attachment: true
semester: 6
subject: MEAN Stack Web Development
category: Originals
summarize: false
---

[attachment:https://static-materio.vercel.app/common/files/attach/4f3001a2-d238-44ff-8108-afb6651fb90c.pdf:Introduction to MEAN Stack]

Data is raw facts, figures, symbols, or observations that by themselves have little or no meaning until they are organized and interpreted. In simple terms, it is the basic input from which useful **information** is produced.  
- Data can be numbers, text, images, audio, video, sensor readings, clicks, or any recordable details about events, objects, or people.
- When this data is processed, structured, and given context (like summarizing sales by month), it becomes information that supports understanding and decision‑making.

## Types of data  

- Quantitative data: Numerical and measurable values, such as age, temperature, sales, or number of users. 
- Qualitative data: Descriptive or non‑numerical details, like reviews, comments, categories, or labels (e.g., “good”, “poor”, “bug found”).
## In computing  

- Computer data is information encoded in a machine‑readable form, usually binary (0s and 1s), so that computers can store, transmit, and process it efficiently. 
- Data is typically organized into structures such as tables, files, or databases to make it easier to query, analyze, and update.

information

Information is data that has been processed, organized, and given context so that it becomes meaningful and useful for understanding or decision‑making. 
- Information is structured or processed **data** that “makes sense” to the person or system using it.
- It answers questions like who, what, where, when, and how by adding context to otherwise raw facts.

## Relation to data  

- Data is raw facts (for example, individual test scores), while information is the result of processing that data into a meaningful form (for example, the class average).
- Information depends on data; without underlying data, no information can be produced.

## In computing

- In computing, information is the useful output produced after a system inputs, stores, and processes raw data.
- It can be represented digitally (binary) and shown as reports, tables, graphs, dashboards, or messages that support decisions.

database
A database is an organized, structured collection of related data, stored electronically so that it can be efficiently accessed, managed, updated, and queried by users or applications.
- A database groups data in a logical way (for example, tables of students, courses, and enrollments) so relationships between items are clear. 
- Specialized **software** called a Database Management System (DBMS) (like MySQL, PostgreSQL, Oracle) is used to create, store, retrieve, and secure this data.

## Key features  

- Supports operations such as inserting, updating, deleting, and searching data quickly, even for very large datasets.
- Often uses Structured Query Language (SQL) so developers and applications can query and manipulate data in a standardized way.

types

Hierarchical and network databases are early or “traditional” database models that organize data differently from modern relational databases. Both are mostly seen today in legacy or very specialized systems.  

## Hierarchical database model  

- Organizes data in a tree‑like structure with parent–child relationships; each child has exactly one parent, but a parent can have multiple children (one‑to‑many).
- Suits data that naturally forms hierarchies (like organization charts or file systems), but is rigid and hard to change or use for complex many‑to‑many relationships.
## Network database model  

- Extends the hierarchical idea by allowing a child record to have multiple parents, representing many‑to‑many relationships using a graph‑like structure with records and links/pointers. 
- More **flexible** than hierarchical databases for complex relationships, but the structure and navigation are more complex to design, program, and maintain. 
## Quick comparison  

| Aspect            | Hierarchical DB                         | Network DB                                      |
|-------------------|-----------------------------------------|-------------------------------------------------|
| Structure         | Tree (parent → child)                   | Graph with records and links                    |
| Relationships     | One‑to‑one, one‑to‑many                  | One‑to‑one, one‑to‑many, many‑to‑many            |
| Parent of a node  | Exactly one parent                      | One or multiple parents                         |
| Flexibility       | Rigid, less flexible                    | More flexible but complex                       |
| Typical usage now | Legacy, niche hierarchical data         | Legacy, specialized complex models              |



Databases come in two main categories: relational (SQL) and non‑relational (NoSQL), each suited for different data needs and workloads. Relational databases emphasize structured data and ACID guarantees, while NoSQL handles unstructured or semi‑structured data at massive scale.  

## Relational databases (SQL)  

- Store data in fixed **tables** with rows and columns, linked by **keys** (primary and foreign keys) to enforce relationships and consistency. [geeksforgeeks](https://www.geeksforgeeks.org/dbms/what-is-database/)
- Use SQL for queries, updates, and schema enforcement; examples include MySQL, PostgreSQL, Oracle, SQL Server. [oracle](https://www.oracle.com/database/what-is-database/)
- Best for transactions needing accuracy (banking, inventory) where data fits a predefined structure. [techtarget](https://www.techtarget.com/searchdatamanagement/definition/database)

## Non‑relational databases (NoSQL)  

- Flexible designs without fixed schemas; data stored in documents, key‑value pairs, graphs, or wide columns for variety and speed. [rivery](https://rivery.io/data-learning-center/database-types-guide/)
- Categories include document (MongoDB), key‑value (Redis), column‑family (Cassandra), graph (Neo4j); often use custom query languages. [thoughtspot](https://www.thoughtspot.com/data-trends/data-modeling/types-of-data-models)
- Ideal for big data, real‑time apps (social media, IoT), or when structure changes often, prioritizing speed and scalability over strict consistency. [rivery](https://rivery.io/data-learning-center/database-types-guide/)

## Quick comparison  

| Aspect             | Relational (SQL)                          | Non‑relational (NoSQL)                    |
|--------------------|-------------------------------------------|-------------------------------------------|
| Data structure     | Tables, rows, columns, schemas  [techtarget](https://www.techtarget.com/searchdatamanagement/definition/database)   | Documents, key‑value, graphs, flexible  [rivery](https://rivery.io/data-learning-center/database-types-guide/) |
| Query language     | SQL (standardized)  [oracle](https://www.oracle.com/database/what-is-database/)               | Varied (JSON, custom APIs)  [rivery](https://rivery.io/data-learning-center/database-types-guide/)       |
| Scalability        | Vertical (bigger servers)  [techtarget](https://www.techtarget.com/searchdatamanagement/definition/database)        | Horizontal (add servers easily)  [thoughtspot](https://www.thoughtspot.com/data-trends/data-modeling/types-of-data-models)  |
| Best for           | Transactions, complex queries  [aws.amazon](https://aws.amazon.com/what-is/database/)    | Big data, speed, variety  [rivery](https://rivery.io/data-learning-center/database-types-guide/)         |
| Consistency        | ACID (strong)  [en.wikipedia](https://en.wikipedia.org/wiki/Database)                    | BASE (eventual)  [rivery](https://rivery.io/data-learning-center/database-types-guide/)                  |


NoSQL databases offer key advantages over traditional SQL ones, especially for handling large, varied, or rapidly changing data in modern apps. They shine in flexibility, speed, and scaling for big data scenarios like social media or IoT.  

## Flexible schema  

- No fixed structure upfront, so you can store structured, semi‑structured, or unstructured data (like JSON documents) and evolve schemas dynamically without downtime or migrations.  
- Great for agile development where data needs change quickly, saving time on redesigns.  

## Horizontal scalability  

- Easily scale out by adding cheap servers (nodes) to distribute data and workload, handling massive growth without slowing down.  
- Ideal for high‑traffic apps, unlike SQL's vertical scaling which needs pricier hardware upgrades.  

## High performance  

- Optimized for fast reads/writes on big datasets, often without complex joins, using denormalized data for low latency.  
- Supports real‑time processing and huge volumes, perfect for analytics or user feeds.



NoSQL databases have surged in popularity due to their ability to handle the explosive growth of big data, web apps, and cloud environments that traditional SQL struggles with. Their design matches modern needs like speed, flexibility, and massive scale.  

## Big data explosion  

- The internet generates **huge volumes** of varied data (user posts, logs, sensors) that NoSQL processes faster and cheaper than SQL for petabyte‑scale workloads.  
- Adopted by giants like Google, Facebook, Netflix for handling millions of users and real‑time updates.  

## Web and cloud era  

- Perfect for **distributed systems** and microservices in cloud platforms (AWS DynamoDB, MongoDB Atlas), scaling horizontally across cheap servers.  
- Rise of mobile, social media, and IoT created needs for flexible, schema‑less storage that NoSQL provides natively.  

## Developer friendly  

- **Agile development**: Change schemas on the fly without breaking apps, speeding up iteration in startups and DevOps.  
- Simpler for unstructured data like JSON, cutting learning curves and boilerplate compared to rigid SQL schemas.


NoSQL databases are grouped into four main types: **document‑based**, **key‑value**, **column‑family (wide‑column)**, and **graph**, each optimized for specific data patterns and use cases.  

## Document‑based  

- Stores data as flexible, self‑contained **documents** (like JSON or BSON) that can have varying fields, ideal for semi‑structured data.  
- Examples: **MongoDB** (stores product catalogs, user profiles), CouchDB.  
- Best for content management, e‑commerce, or apps with evolving schemas.  

## Key‑value  

- Simplest type: Data as unique **keys** mapped to simple or complex **values** (strings, blobs), super fast for lookups.  
- Examples: **Redis** (caching, sessions), DynamoDB, Riak.  
- Perfect for session storage, leaderboards, or real‑time apps needing speed.  

## Column‑family (wide‑column)  

- Organizes data by **columns** grouped into families, not rows; great for sparse data and analytics.  
- Examples: **Cassandra** (handles time‑series, IoT, logs), HBase.  
- Suited for big data analytics, monitoring, or write‑heavy apps.  

## Graph  

- Models data as **nodes** (entities), **edges** (relationships), and properties; excels at connected data.  
- Examples: **Neo4j** (social networks, fraud detection), Amazon Neptune.  
- Ideal for recommendations, networks, or queries like “friends of friends”.

MongoDB is a popular open‑source **document‑oriented NoSQL database** that stores data in flexible JSON‑like documents (BSON format), making it easy to scale and develop modern apps. Launched in 2009, it powers companies like Google, Adobe, and Forbes for handling diverse, high‑volume data.  

## Core structure  

- **Documents**: Basic units like JSON objects with key‑value pairs (e.g., {"name": "Raj", "age": 20, "city": "Rajkot"}); supports nesting and arrays.  
- **Collections**: Groups of documents, like tables but schema‑free (documents in one collection can differ).  
- **Databases**: Containers holding multiple collections.  

## Key features  

- **Schema flexibility**: Add or change fields anytime without migrations.  
- **Horizontal scaling**: Shard data across servers for massive growth; replication for high availability.  
- **Query power**: Rich queries, indexing, aggregation pipelines for analytics (like SQL GROUP BY).  
- **ACID support**: Multi‑document transactions since v4.0 for reliability.  

## Real‑life analogy  

Think of MongoDB as a **digital notebook** where each page (document) holds related info freely—no rigid columns—perfect for apps like blogs (posts with varying tags/images) or e‑commerce (products with optional specs).  

## Exam tip  

**Mnemonic**: "Mongo = Massive, Open, NoSQL, Great for Objects" – remember it stores **objects** natively, unlike tables in SQL. Practice inserting a document: `db.students.insertOne({name: "Ali", marks: 85})`.


MongoDB's internals revolve around **BSON serialization**, **WiredTiger storage engine**, and flexible document storage, differing from MySQL's rigid table‑based rows. Here's a simple breakdown with direct mappings.  

## Data format: JSON to BSON  

- Starts as **JSON** (human‑readable: `{"name": "Raj", "marks": 85}`) but converts to **BSON** (binary JSON) for efficient storage and querying.  
- BSON adds types like **int32** (32‑bit integers, e.g., small counts), **int64** (64‑bit for big numbers like timestamps), doubles, strings, ObjectIds, dates, arrays—compact and fast.  
- **Mapping**: MySQL stores mixed types in flexible columns; MongoDB embeds everything in documents for speed.  

## Storage engine: WiredTiger  

- **Default engine** since MongoDB 3.2: Handles reads/writes with document‑level locking (finer than MySQL's row/table locks), compression (Snappy), and checkpoints for crash recovery.  
- Internals: Data in **B‑tree files** (e.g., `collection‑0‑XXXX.wt`), catalog (`_mdb_catalog.wt`), history store (`WiredTigerHS.wt`) for MVCC snapshots.  
- **Read/write**: Optimistic concurrency; writes append to logs (WAL), reads from cache/disk. Scales with filesystem cache.  

## MySQL vs MongoDB mapping  

| MySQL concept    | MongoDB equivalent             | Key difference                          |
|------------------|--------------------------------|-----------------------------------------|
| **Tables**       | **Collections**                | Schema‑free; mix document shapes        |
| **Rows**         | **Documents** (BSON objects)   | Nested/embedded; no fixed order         |
| **Columns**      | **Fields** (key‑value pairs)   | Dynamic; arrays/objects inside          |
| **InnoDB**       | **WiredTiger**                 | Document locking vs row locking         |
| **SQL query**    | **Mongo query** (JSON filters) | No joins; use aggregation pipelines     |

## Real‑life tip  

Imagine MySQL as **spreadsheet rows** (fixed columns)—great for reports. MongoDB is like **nested folders** (documents with sub‑files)—flexible for apps like chats (messages with attachments). **Mnemonic**: "BSON = Binary Super Objects, Not tables". Test: Insert `db.users.insertOne({name: "Ali", scores: [90, 85]})`—see int32 arrays in BSON dump!


MongoDB uses simple shell commands (in **mongosh**) to create and manage databases/collections—databases are created **implicitly** on first use. Here's a step‑by‑step table of essential commands, starting from setup.  

## Essential MongoDB Commands Table  

| Step/Action              | Command                                      | Example / Notes                                      |
|--------------------------|----------------------------------------------|-----------------------------------------------------|
| **Connect & show DBs**   | `show dbs`                                   | Lists all databases (needs data to show).           |
| **Switch/Create DB**     | `use mydb`                                   | Switches to `mydb`; creates if new (implicit).      |
| **Create Collection**    | `db.createCollection("students")`            | Explicitly creates empty collection.                |
| **Insert One Document**  | `db.students.insertOne({name: "Raj", age: 20})` | Adds single BSON doc; auto‑creates collection/DB. |
| **Insert Many**          | `db.students.insertMany([{name: "Ali"}, {name: "Priya"}])` | Batch insert; ordered by default.             |
| **Show Collections**     | `show collections` or `db.getCollectionNames()` | Lists collections in current DB.                 |
| **Find All**             | `db.students.find()`                         | Shows all docs (use `.pretty()` for nice format).   |
| **Find with Filter**     | `db.students.find({age: {$gt: 18}})`         | Age > 18; operators like `$eq`, `$in`, `$regex`.    |
| **Update One**           | `db.students.updateOne({name: "Raj"}, {$set: {marks: 85}})` | Updates first match; `$set`, `$inc`, `$push`. |
| **Update Many**          | `db.students.updateMany({age: {$lt: 21}}, {$set: {group: "A"}})` | Updates all matches.                     |
| **Delete One**           | `db.students.deleteOne({name: "Ali"})`       | Deletes first match.                                |
| **Delete Many**          | `db.students.deleteMany({marks: {$lt: 50}})` | Deletes all low marks.                              |
| **Drop Collection**      | `db.students.drop()`                         | Deletes entire collection.                          |
| **Drop DB**              | `db.dropDatabase()`                          | Deletes current DB (careful!).                      |

## Quick start sequence  
```
use school          # Switch/create DB
db.students.insertOne({name: "Raj", city: "Rajkot"})  # Creates collection + data
db.students.find().pretty()  # View data nicely
show collections    # List in DB
```

**Tip**: No `CREATE DATABASE` like SQL—**use + insert** does it. **Mnemonic**: "Use DB, Insert Doc, Find Fun!" Practice in free MongoDB Atlas playground for exams.



Here’s a table of **additional MongoDB commands** (excluding basic CRUD like insertOne/Many, find, updateOne/Many, deleteOne/Many from before). These cover advanced ops like **findAndModify** (atomic find+replace), **upsert**, **indexing**, aggregation, and more for exams/practice.  

## Advanced MongoDB Commands Table  

| Command Category      | Command                                      | Example / Notes                                                                 |
|-----------------------|----------------------------------------------|---------------------------------------------------------------------------------|
| **Find & Modify**     | `db.students.findOneAndUpdate({name: "Raj"}, {$set: {marks: 90}}, {returnDocument: "after"})` | Atomic find+update; returns old ("before") or new ("after") doc. Use for counters. |
| **Upsert**            | `db.students.updateOne({name: "New"}, {$set: {marks: 95}}, {upsert: true})` | Update if exists, **insert** if not; great for "set if absent".                  |
| **Replace**           | `db.students.replaceOne({name: "Raj"}, {name: "Raj", marks: 95, grade: "A"})` | Fully replaces matching doc (loses extra fields); not partial like update.      |
| **Count**             | `db.students.countDocuments({marks: {$gt: 80}})` | Counts matching docs; faster than `find().count()`.                            |
| **Distinct**          | `db.students.distinct("city")`               | Returns **unique values** for a field (e.g., ["Rajkot", "Ahmedabad"]).          |
| **Create Index**      | `db.students.createIndex({name: 1})`         | Speeds queries; `1` ascending, `-1` descending. Compound: `{name:1, marks:-1}`. |
| **List Indexes**      | `db.students.getIndexes()`                   | Shows all indexes on collection.                                               |
| **Drop Index**        | `db.students.dropIndex("name_1")`            | Drops specific index (name from getIndexes).                                   |
| **Aggregation**       | `db.students.aggregate([{$match: {marks: {$gt: 80}}}, {$group: {_id: "$city", avg: {$avg: "$marks"}}}])` | Pipeline for GROUP BY, SUM, etc.; like SQL analytics.                         |
| **Limit & Sort**      | `db.students.find().sort({marks: -1}).limit(5)` | Top 5 by marks descending; chain with skip for pagination.                    |
| **Projection**        | `db.students.find({}, {name:1, marks:1, _id:0})` | Select **only** fields (1=include, 0=exclude); slim results.                   |
| **Drop Index All**    | `db.students.dropIndexes()`                  | Removes all indexes except default _id.                                        |

## Exam tricks  
- **findOneAndUpdate** vs **updateOne**: Atomic + returns doc (use for likes/votes).  
- **Upsert mnemonic**: "Up‑SERT = Update or iNSERT".  
- **Index tip**: Always index queried fields (name, email); slows inserts but speeds finds 100x. Practice aggregation for "average marks by city"!




**Schema design** defines the **structure and rules** for data storage (tables/fields in SQL, documents in MongoDB), while **data modeling** is the broader process of planning **how data relates and flows** to fit app needs. Schema is the "blueprint"; modeling decides the blueprint.  

## Schema Design  

- Focuses on **physical structure**: Field names, types, constraints, indexes (SQL enforces rigidly; MongoDB flexible).  
- In SQL (MySQL): `CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(50))`.  
- In MongoDB: **Optional** validation like `db.createCollection("students", {validator: { $jsonSchema: { bsonType: "object", required: ["name"], properties: {name: {bsonType: "string"}}}}})`.  

## Data Modeling  

- **Conceptual/logical planning**: Identify entities, relationships (one‑to‑many?), access patterns, then choose embed/reference.  
- Questions: Read/write ratio? Embed for reads (fast, no joins) or reference for writes (avoid duplication)?  
- MongoDB example: Model blog post with comments **embedded** (array of comment docs) for quick full loads.  

## Key differences  

| Aspect              | Schema Design                          | Data Modeling                              |
|---------------------|----------------------------------------|--------------------------------------------|
| **Focus**           | Structure, validation, storage  [stackoverflow](https://stackoverflow.com/questions/25093452/difference-between-data-model-and-database-schema-in-dbms) | Relationships, queries, app workflow  [projectmanagementplanet](https://www.projectmanagementplanet.com/data-modeling-mongodb-vs-rdbms-schema-design/) |
| **When**            | Implementation step  [dbschema](https://dbschema.com/blog/design/sql-vs-nosql-explained/)          | Early planning, iterative  [mongodb](https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/)        |
| **SQL**             | Rigid, upfront DDL  [dbschema](https://dbschema.com/blog/design/sql-vs-nosql-explained/)           | Normalized (3NF), joins  [projectmanagementplanet](https://www.projectmanagementplanet.com/data-modeling-mongodb-vs-rdbms-schema-design/)          |
| **MongoDB**         | Flexible, runtime  [mongodb](https://www.mongodb.com/docs/manual/data-modeling/)            | Embedding/referencing patterns  [mongodb](https://www.mongodb.com/resources/basics/databases/nosql-explained/data-modeling)   |
| **Output**          | Tables/collections ready  [stackoverflow](https://stackoverflow.com/questions/25093452/difference-between-data-model-and-database-schema-in-dbms)     | ER diagrams, patterns  [mongodb](https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/)            |

## Real‑life example  

**E‑commerce**: Modeling decides "embed product reviews in product doc?" (fast reads). Schema then defines fields like `{reviews: [{user: string, rating: int32}]}`. **Tip**: For exams, remember "Model first (why), Schema second (how)"—MongoDB flips SQL's rigid order!



MongoDB data modeling uses two main **approaches** for relationships: **embedded documents** (store data inside one doc) and **referencing** (link to another collection via IDs). Choose based on access patterns, growth, and the **16MB doc limit**—reference when embedding would exceed it or bloat docs.  

## Embedded documents  

- **Related data lives inside** the parent document (arrays/objects), fetched in **one query**—fast reads, atomic updates.  
- Example: Blog post with comments:  
  ```json
  {
    "_id": "...",
    "title": "Mongo Tips",
    "comments": [{ "user": "Raj", "text": "Great!" }, { "user": "Ali", "text": "Thanks" }]
  }
  ```  
- **Best when**: 1:few (small arrays), always read together, rarely updated separately.  

## Referencing documents  

- Store related data in **separate collection**, link with **ObjectId** refs—multiple queries but avoids duplication and size limits.  
- Example: Separate comments collection:  
  ```json
  // posts collection
  { "_id": ObjectId("..."), "title": "Mongo Tips" }
  // comments collection  
  { "_id": "...", "postId": ObjectId("..."), "user": "Raj", "text": "Great!" }
  ```  
- Query: `db.comments.find({postId: ObjectId("...")})`.  

## When to use each  

| Scenario                     | **Embed**                          | **Reference**                                      |
|------------------------------|------------------------------------|----------------------------------------------------|
| **Relationship**             | 1:1 or 1:few (comments <100)      | 1:many or many:many (viral posts, users→posts)     |
| **Access**                   | Always together (read profile+address) | Independent (query comments alone)                |
| **Updates**                  | Rare on child (static bio)        | Frequent/child grows (user edits comments often)   |
| **Size limit hit**           | No (under 16MB)                   | **Yes**—split large arrays/docs                    |
| **MongoDB doc max**          | Stays small                       | Each doc flexible, no single‑doc bloat             |

## Pro tip & mnemonic  
- **Rule**: "Together forever? Embed. Growing giants? Reference."  
- **16MB trap**: Viral thread (1000+ comments)? Reference or bucket (sub‑arrays by date). Test: Embed grows → `db.posts.updateOne({}, {$push: {comments: {...}}})` fails at limit!


MongoDB **Aggregation Framework** is a powerful pipeline for advanced data processing—like SQL's GROUP BY, JOINs, analytics—but on **documents**, using stages chained in an array. Syntax: `db.collection.aggregate([ { $stage1 }, { $stage2 } ])`.  

## Key pipeline stages  

| Stage              | Purpose & Syntax Example                                      | Like SQL Equivalent         |
|--------------------|---------------------------------------------------------------|-----------------------------|
| **$match**         | **Filter** docs early (boosts speed) `{ $match: {age: {$gt: 18}} }` | WHERE clause                |
| **$project**       | **Select/reshape** fields `{ $project: {name:1, marks:1, _id:0} }` | SELECT columns              |
| **$group**         | **Group & aggregate** `{ $group: {_id: "$city", avgMarks: {$avg: "$marks"}, count: {$sum:1}} }` | GROUP BY, AVG(), COUNT()    |
| **$sort**          | **Sort** results `{ $sort: {marks: -1} }` (1 asc, -1 desc)    | ORDER BY                    |
| **$limit** / **$skip** | Limit results `{ $limit: 10 }, { $skip: 20 }`                | LIMIT, OFFSET               |
| **$unwind**        | **Flatten** arrays `{ $unwind: "$skills" }`                   | Normalize arrays            |
| **$lookup**        | **Join** collections `{ $lookup: {from: "comments", localField: "_id", foreignField: "postId", as: "comments"} }` | LEFT JOIN                   |

## Full example: Average marks by city  
```
db.students.aggregate([
  { $match: {marks: {$gte: 50}} },      // Filter pass
  { $group: {_id: "$city", avg: {$avg: "$marks"}, students: {$sum: 1}}},  // Group calc
  { $sort: {avg: -1} },                 // Top first
  { $project: {city: "$_id", avg:1, students:1, _id:0} }  // Rename/format
])
```
**Output**: `[{city: "Rajkot", avg: 82.5, students: 5}, ...]`.  

## Pro tips  
- **Order matters**: `$match` first, `$group` before `$sort`.  
- **Operators**: `$sum`, `$avg`, `$min`, `$max`, `$push` (collect array), `$addToSet` (unique).  
- **Mnemonic**: "Match Project Group Sort Limit = **M PGSL** pipeline flow". Practice for exams: Compute "top 3 cities by avg marks >75"!
