---
slug: repository-pattern-unit-of-work-dotnet
title: "Implementing Repository Pattern with Unit of Work in .NET Core"
authors: [ouwesh]
tags: [csharp, dotnet, design-patterns, repository-pattern, unit-of-work, entity-framework]
description: >
  A comprehensive guide to implementing the Repository Pattern with Unit of Work 
  in .NET Core applications for clean and maintainable data access.
---

In this article, we'll dive deep into implementing the Repository Pattern with Unit of Work in .NET Core applications. This architectural pattern helps abstract data access logic from business logic, making your application more maintainable, testable, and flexible.

<!-- truncate -->

## Overview

The Repository Pattern is a design pattern that mediates between the domain and data mapping layers, acting like an in-memory collection of domain objects. When combined with the Unit of Work pattern, it provides a clean way to manage database transactions and maintain data consistency.

## Core Components

### 1. The Repository Pattern

The Repository Pattern abstracts the data access layer, providing a collection-like interface for accessing domain objects. Here's the base interface:

```csharp
public interface IRepositoryBase<T>
{
    IQueryable<T> FindAll();
    IQueryable<T> FindByCondition(Expression<Func<T, bool>> expression);
    PaginationResponse<T> FindByCondition(
        Expression<Func<T, bool>> expression, 
        PaginationFilter paginationFilter, 
        params Expression<Func<T, object>>[] includeExpressions);
    void Create(T entity);
    void Update(T entity);
    void Delete(T entity);
    int CountAll();
    int Count(Expression<Func<T, bool>> expression);
}
```

### 2. Base Repository Implementation

The base implementation provides common CRUD operations:

```csharp
public abstract class RepositoryBase<T> : IRepositoryBase<T> where T : class
{
    protected MainContext RepositoryContext { get; }
    
    protected RepositoryBase(MainContext repositoryContext)
    {
        RepositoryContext = repositoryContext;
    }

    public IQueryable<T> FindAll() => 
        RepositoryContext.Set<T>().AsNoTracking();

    public IQueryable<T> FindByCondition(Expression<Func<T, bool>> expression) => 
        RepositoryContext.Set<T>().Where(expression).AsNoTracking();

    // Other implementations...
}
```

### 3. Entity-Specific Repositories

For each entity, create a specific interface and implementation:

```csharp
public interface IUserRepository : IRepositoryBase<User>
{
    Task<User> GetByEmailAsync(string email);
    Task<bool> IsEmailUniqueAsync(string email);
}

public class UserRepository : RepositoryBase<User>, IUserRepository
{
    public UserRepository(MainContext repositoryContext) 
        : base(repositoryContext)
    {
    }

    public async Task<User> GetByEmailAsync(string email)
    {
        return await FindByCondition(u => u.Email == email)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> IsEmailUniqueAsync(string email)
    {
        return !await FindByCondition(u => u.Email == email)
            .AnyAsync();
    }
}
```

### 4. Unit of Work Pattern

The Unit of Work pattern maintains a list of objects affected by a business transaction and coordinates the writing out of changes.

```csharp
public interface IRepositoryWrapper
{
    IUserRepository User { get; }
    IProductRepository Product { get; }
    // Other repositories...
    Task SaveAsync();
}

public class RepositoryWrapper : IRepositoryWrapper
{
    private readonly MainContext _context;
    private IUserRepository _user;
    private IProductRepository _product;
    // Other repositories...

    public RepositoryWrapper(MainContext context)
    {
        _context = context;
    }

    public IUserRepository User => 
        _user ??= new UserRepository(_context);
    
    public IProductRepository Product => 
        _product ??= new ProductRepository(_context);
    
    // Other repository properties...

    public async Task SaveAsync()
    {
        await _context.SaveChangesAsync();
    }
}
```

## Setting Up Dependency Injection

In your `Startup.cs` or `Program.cs`:

```csharp
public void ConfigureServices(IServiceCollection services)
{
    // Register database context
    services.AddDbContext<MainContext>(options => 
        options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));

    // Register Unit of Work
    services.AddScoped<IRepositoryWrapper, RepositoryWrapper>();
}
```

## Using the Repository in Services

Here's how to use the repository in your service layer:

```csharp
public class UserService : IUserService
{
    private readonly IRepositoryWrapper _repository;

    public UserService(IRepositoryWrapper repository)
    {
        _repository = repository;
    }

    public async Task<PagedList<User>> GetUsersAsync(int pageNumber, int pageSize)
    {
        var filter = new PaginationFilter 
        { 
            PageNumber = pageNumber, 
            PageSize = pageSize,
            SortBy = "LastName",
            SortDirection = SortDirection.ASC
        };

        var result = _repository.User
            .FindByCondition(u => u.IsActive, filter);

        return new PagedList<User>
        {
            Items = await result.query.ToListAsync(),
            TotalCount = result.count,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }

    public async Task<User> RegisterUserAsync(UserRegistrationDto dto)
    {
        if (await _repository.User.IsEmailUniqueAsync(dto.Email))
        {
            var user = new User
            {
                Email = dto.Email,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                // Map other properties
            };

            _repository.User.Create(user);
            await _repository.SaveAsync();
            
            return user;
        }

        throw new InvalidOperationException("Email already exists");
    }
}
```

## Advantages of This Implementation

1. **Separation of Concerns**: Data access logic is abstracted from business logic
2. **Testability**: Easy to mock repositories for unit testing
3. **Code Reusability**: Common operations are implemented once in the base class
4. **Maintainability**: Changes to data access logic are centralized
5. **Flexibility**: Easy to switch between different data access technologies

## Best Practices

1. **Use Async/Await**: Always prefer asynchronous methods to avoid blocking calls
2. **Implement IDisposable**: If you need to manage resources
3. **Keep Business Logic Out**: Repositories should only handle data access
4. **Use IQueryable Wisely**: It allows for flexible query composition but be aware of potential performance implications
5. **Consider CQRS**: For complex applications, consider separating read and write operations

## Conclusion

The Repository Pattern with Unit of Work provides a clean architecture for data access in .NET applications. It makes your code more maintainable, testable, and flexible. By following the implementation shown in this article, you can create a robust data access layer that can evolve with your application's needs.

Remember that while this pattern provides many benefits, it's essential to evaluate whether it's the right fit for your specific use case, especially with modern ORMs like Entity Framework Core that already implement some of these patterns internally.
